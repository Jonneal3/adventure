from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import requests


def _env_int(name: str, default: int) -> int:
    try:
        v = int(str(os.getenv(name) or "").strip() or default)
        return v
    except Exception:
        return int(default)


def _now_s() -> float:
    return time.time()


def _minute_window(now_s: Optional[float] = None) -> Tuple[int, float]:
    """
    Returns (window_id, seconds_until_reset).
    window_id: unix minute (floor(now/60))
    """
    t = float(now_s if now_s is not None else _now_s())
    wid = int(t // 60.0)
    reset_in = (wid + 1) * 60.0 - t
    return wid, max(0.0, reset_in)


def _day_window(now_s: Optional[float] = None) -> Tuple[int, float]:
    """
    Returns (window_id, seconds_until_reset).
    window_id: unix day (floor(now/86400))
    """
    t = float(now_s if now_s is not None else _now_s())
    wid = int(t // 86400.0)
    reset_in = (wid + 1) * 86400.0 - t
    return wid, max(0.0, reset_in)


def estimate_tokens_from_text(text: str) -> int:
    """
    Very rough token estimate (works reasonably across GPT/Llama tokenizers).
    """
    t = str(text or "")
    # 4 chars/token is a standard coarse heuristic.
    return max(1, int(len(t) / 4) + 1)


@dataclass(frozen=True)
class RateLimitSnapshot:
    ok: bool
    scope: str  # "global" or "session"
    window: str  # "minute" or "day"
    limit_requests: int
    limit_tokens: int
    used_requests: int
    used_tokens: int
    remaining_requests: int
    remaining_tokens: int
    reset_after_sec: float
    reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ok": bool(self.ok),
            "scope": self.scope,
            "window": self.window,
            "limitRequests": int(self.limit_requests),
            "limitTokens": int(self.limit_tokens),
            "usedRequests": int(self.used_requests),
            "usedTokens": int(self.used_tokens),
            "remainingRequests": int(self.remaining_requests),
            "remainingTokens": int(self.remaining_tokens),
            "resetAfterSec": float(self.reset_after_sec),
            **({"reason": self.reason} if self.reason else {}),
        }


class RateLimitStore:
    """
    Store that can atomically reserve (requests,tokens) against fixed-window counters.
    """

    def reserve_fixed_window(
        self,
        *,
        key_prefix: str,
        window: str,
        window_id: int,
        ttl_sec: int,
        req_limit: int,
        tok_limit: int,
        req_cost: int,
        tok_cost: int,
    ) -> Tuple[bool, int, int]:
        raise NotImplementedError


class MemoryRateLimitStore(RateLimitStore):
    def __init__(self) -> None:
        self._lock = threading.Lock()
        # key -> (expires_at_s, req_used, tok_used)
        self._buckets: Dict[str, Tuple[float, int, int]] = {}

    def reserve_fixed_window(
        self,
        *,
        key_prefix: str,
        window: str,
        window_id: int,
        ttl_sec: int,
        req_limit: int,
        tok_limit: int,
        req_cost: int,
        tok_cost: int,
    ) -> Tuple[bool, int, int]:
        ttl = max(1, int(ttl_sec or 0))
        now = _now_s()
        k = f"{key_prefix}:{window}:{window_id}"
        with self._lock:
            rec = self._buckets.get(k)
            if rec and rec[0] <= now:
                self._buckets.pop(k, None)
                rec = None
            if rec:
                expires_at, used_r, used_t = rec
            else:
                expires_at, used_r, used_t = now + ttl, 0, 0
            next_r = used_r + int(req_cost)
            next_t = used_t + int(tok_cost)
            if (req_limit > 0 and next_r > req_limit) or (tok_limit > 0 and next_t > tok_limit):
                return False, used_r, used_t
            self._buckets[k] = (expires_at, next_r, next_t)
            return True, next_r, next_t


class UpstashRestRateLimitStore(RateLimitStore):
    """
    Minimal Upstash Redis REST store using EVAL for atomic reserve.

    Requires:
      - UPSTASH_REDIS_REST_URL
      - UPSTASH_REDIS_REST_TOKEN
    """

    _LUA_RESERVE = r"""
local req_key = KEYS[1]
local tok_key = KEYS[2]
local req_limit = tonumber(ARGV[1])
local tok_limit = tonumber(ARGV[2])
local req_cost = tonumber(ARGV[3])
local tok_cost = tonumber(ARGV[4])
local ttl_ms = tonumber(ARGV[5])

local req_used = redis.call('INCRBY', req_key, req_cost)
if req_used == req_cost then
  redis.call('PEXPIRE', req_key, ttl_ms)
end

local tok_used = redis.call('INCRBY', tok_key, tok_cost)
if tok_used == tok_cost then
  redis.call('PEXPIRE', tok_key, ttl_ms)
end

if (req_limit > 0 and req_used > req_limit) or (tok_limit > 0 and tok_used > tok_limit) then
  redis.call('DECRBY', req_key, req_cost)
  redis.call('DECRBY', tok_key, tok_cost)
  return {0, req_used - req_cost, tok_used - tok_cost}
end

return {1, req_used, tok_used}
""".strip()

    def __init__(self, *, rest_url: str, rest_token: str) -> None:
        self._url = rest_url.rstrip("/")
        self._token = rest_token.strip()

    def _call(self, cmd: list[Any]) -> Any:
        # Upstash REST API accepts POST {\"command\": [...]} at /execute
        # but also accepts raw array body at /pipeline in many configs.
        # We support the more common /pipeline shape by sending JSON array of commands.
        # If that fails, fall back to /execute.
        headers = {"Authorization": f"Bearer {self._token}", "Content-Type": "application/json"}

        # Try /execute first (single command)
        try:
            resp = requests.post(f"{self._url}/execute", headers=headers, data=json.dumps({"command": cmd}), timeout=5)
            data = resp.json()
            if resp.ok:
                # Shape: {\"result\": ...}
                return data.get("result") if isinstance(data, dict) else data
        except Exception:
            pass

        # Fallback: /pipeline expects [[cmd...]]
        resp2 = requests.post(f"{self._url}/pipeline", headers=headers, data=json.dumps([cmd]), timeout=5)
        data2 = resp2.json()
        if not resp2.ok:
            raise RuntimeError(f"Upstash reserve failed ({resp2.status_code}): {str(data2)[:400]}")
        # Shape: [{\"result\": ...}]
        if isinstance(data2, list) and data2:
            first = data2[0]
            if isinstance(first, dict) and "result" in first:
                return first.get("result")
        return data2

    def reserve_fixed_window(
        self,
        *,
        key_prefix: str,
        window: str,
        window_id: int,
        ttl_sec: int,
        req_limit: int,
        tok_limit: int,
        req_cost: int,
        tok_cost: int,
    ) -> Tuple[bool, int, int]:
        req_key = f"{key_prefix}:{window}:{window_id}:req"
        tok_key = f"{key_prefix}:{window}:{window_id}:tok"
        ttl_ms = max(1000, int(ttl_sec * 1000))
        cmd: list[Any] = [
            "EVAL",
            self._LUA_RESERVE,
            "2",
            req_key,
            tok_key,
            str(int(req_limit)),
            str(int(tok_limit)),
            str(int(req_cost)),
            str(int(tok_cost)),
            str(int(ttl_ms)),
        ]
        out = self._call(cmd)
        if isinstance(out, list) and len(out) >= 3:
            ok = int(out[0]) == 1
            used_r = int(out[1])
            used_t = int(out[2])
            return ok, used_r, used_t
        # Unexpected payload
        raise RuntimeError(f"Unexpected Upstash reserve response: {out}")


_STORE_SINGLETON: Optional[RateLimitStore] = None
_STORE_LOCK = threading.Lock()


def get_rate_limit_store() -> RateLimitStore:
    global _STORE_SINGLETON
    with _STORE_LOCK:
        if _STORE_SINGLETON is not None:
            return _STORE_SINGLETON

        store_kind = str(os.getenv("AI_FORM_RATE_LIMIT_STORE") or "").strip().lower()
        if not store_kind:
            # Prefer Upstash if configured, else memory.
            store_kind = "upstash" if os.getenv("UPSTASH_REDIS_REST_URL") and os.getenv("UPSTASH_REDIS_REST_TOKEN") else "memory"

        if store_kind == "upstash":
            url = str(os.getenv("UPSTASH_REDIS_REST_URL") or "").strip()
            tok = str(os.getenv("UPSTASH_REDIS_REST_TOKEN") or "").strip()
            if url and tok:
                _STORE_SINGLETON = UpstashRestRateLimitStore(rest_url=url, rest_token=tok)
                return _STORE_SINGLETON
            # fall back
            store_kind = "memory"

        _STORE_SINGLETON = MemoryRateLimitStore()
        return _STORE_SINGLETON


def _limits_for_scope(scope: str) -> Dict[str, int]:
    """
    Return limits for a given scope.

    Defaults are intentionally safe for local dev and should be set explicitly in env for production.
    (See Groq org limits for your account/model.)
    """
    s = str(scope or "").strip().lower()
    if s == "session":
        return {
            "rpm": _env_int("AI_FORM_GROQ_SESSION_RPM", 10),
            "tpm": _env_int("AI_FORM_GROQ_SESSION_TPM", 8000),
            "rpd": _env_int("AI_FORM_GROQ_SESSION_RPD", 500),
            "tpd": _env_int("AI_FORM_GROQ_SESSION_TPD", 200000),
        }
    # global
    return {
        "rpm": _env_int("AI_FORM_GROQ_RPM", 30),
        "tpm": _env_int("AI_FORM_GROQ_TPM", 12000),
        "rpd": _env_int("AI_FORM_GROQ_RPD", 1000),
        "tpd": _env_int("AI_FORM_GROQ_TPD", 1000000),
    }


def reserve_planner_budget(
    *,
    instance_id: str,
    session_id: str,
    model_id_or_version: str,
    estimated_tokens: int,
) -> Tuple[bool, Dict[str, Any]]:
    """
    Attempt to reserve planner capacity for BOTH:
      - per-session budgets
      - global budgets

    Returns (ok, details_dict).
    """
    inst = str(instance_id or "").strip()[:80] or "unknown"
    sess = str(session_id or "").strip()[:80] or "unknown"
    model = str(model_id_or_version or "").strip()[:120] or "unknown"
    tok_cost = max(1, int(estimated_tokens or 0))
    req_cost = 1

    store = get_rate_limit_store()
    now = _now_s()
    minute_id, minute_reset = _minute_window(now)
    day_id, day_reset = _day_window(now)

    out: Dict[str, Any] = {
        "ok": True,
        "estimatedTokens": tok_cost,
        "model": model,
        "store": store.__class__.__name__,
        "windows": [],
    }

    def _reserve(scope: str, window: str, window_id: int, reset_after: float) -> RateLimitSnapshot:
        lim = _limits_for_scope(scope)
        if window == "minute":
            req_limit, tok_limit, ttl = lim["rpm"], lim["tpm"], int(reset_after) + 3
        else:
            req_limit, tok_limit, ttl = lim["rpd"], lim["tpd"], int(reset_after) + 10

        key_prefix = f"ai_form:rl:{scope}:planner:{inst}:{sess if scope=='session' else 'all'}:{model}"
        ok, used_r, used_t = store.reserve_fixed_window(
            key_prefix=key_prefix,
            window=window,
            window_id=int(window_id),
            ttl_sec=ttl,
            req_limit=int(req_limit),
            tok_limit=int(tok_limit),
            req_cost=req_cost,
            tok_cost=tok_cost,
        )
        remaining_r = max(0, int(req_limit) - int(used_r)) if req_limit > 0 else 0
        remaining_t = max(0, int(tok_limit) - int(used_t)) if tok_limit > 0 else 0
        return RateLimitSnapshot(
            ok=bool(ok),
            scope=scope,
            window=window,
            limit_requests=int(req_limit),
            limit_tokens=int(tok_limit),
            used_requests=int(used_r),
            used_tokens=int(used_t),
            remaining_requests=int(remaining_r),
            remaining_tokens=int(remaining_t),
            reset_after_sec=float(reset_after),
            reason=None if ok else "exceeded",
        )

    snapshots: list[RateLimitSnapshot] = []
    # Reserve per-session first (fairness), then global (never exceed provider).
    for scope in ("session", "global"):
        snapshots.append(_reserve(scope, "minute", minute_id, minute_reset))
        snapshots.append(_reserve(scope, "day", day_id, day_reset))

    out["windows"] = [s.to_dict() for s in snapshots]
    ok_all = all(s.ok for s in snapshots)
    out["ok"] = bool(ok_all)
    if not ok_all:
        # Retry-after: pick the smallest reset among violated windows.
        violated = [s for s in snapshots if not s.ok]
        retry_after = min((s.reset_after_sec for s in violated), default=2.0)
        out["retryAfterSec"] = float(max(1.0, retry_after))
        out["reason"] = violated[0].scope + "_" + violated[0].window
    return bool(ok_all), out


def extract_provider_rate_headers(obj: Any) -> Optional[Dict[str, str]]:
    """
    Best-effort extraction of provider rate limit headers when the LM stack exposes them.
    We keep this flexible because DSPy/LiteLLM shapes vary.
    """
    if not obj:
        return None
    # Common patterns: usage dict may contain raw headers
    if isinstance(obj, dict):
        for k in ("response_headers", "headers", "rate_limit_headers", "rateLimitHeaders"):
            v = obj.get(k)
            if isinstance(v, dict) and v:
                out: Dict[str, str] = {}
                for hk, hv in v.items():
                    if isinstance(hk, str) and hk and isinstance(hv, (str, int, float)):
                        out[hk.lower()] = str(hv)
                return out or None
    return None

