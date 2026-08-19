"""Adventure V7 intelligence contracts — ProjectState is the authority."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TasteTag(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    label: str
    attribute_path: str = Field(default="", alias="attributePath")
    image_url: str = Field(default="", alias="imageUrl")
    focal_x: float = Field(default=50.0, alias="focalX")
    focal_y: float = Field(default=50.0, alias="focalY")
    selected: bool = True


class TasteProfile(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    tags: List[TasteTag] = Field(default_factory=list)
    confirmed_ids: List[str] = Field(default_factory=list, alias="confirmedIds")
    source: Literal["ontology", "vision", "hybrid"] = "ontology"


class ProjectService(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str = ""
    business_label: str = Field(default="", alias="businessLabel")
    customer_label: str = Field(default="", alias="customerLabel")
    industry: str = ""
    summary: str = ""
    visual_eligible: bool = Field(default=True, alias="visualEligible")


class ProjectScopeItem(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    key: str = ""
    label: str = ""
    source: Literal["business", "ai", "customer", "stored"] = "stored"


class ProjectScope(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    items: List[ProjectScopeItem] = Field(default_factory=list)
    other_text: str = Field(default="", alias="otherText")
    mode: Literal["single", "multi"] = "multi"

    def labels(self) -> List[str]:
        labels = [i.label.strip() for i in self.items if i.label and i.label.strip()]
        if self.other_text.strip():
            labels.append(self.other_text.strip())
        return labels

    def keys(self) -> List[str]:
        out: List[str] = []
        for item in self.items:
            key = (item.key or item.label or "").strip()
            if key:
                out.append(key)
        return out

    def joined(self, default: str = "General") -> str:
        labels = self.labels()
        return ", ".join(labels) if labels else default


class ProjectBudget(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    amount: float = 0
    band_id: Optional[str] = Field(default=None, alias="bandId")
    currency: str = "USD"
    source: Literal["ai", "business", "customer", "learned"] = "customer"
    confidence: float = 0.5


class ProjectPhotoAnalysis(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    materials: List[str] = Field(default_factory=list)
    condition: str = ""
    constraints: List[str] = Field(default_factory=list)
    notes: str = ""
    raw: Optional[Dict[str, Any]] = None


class ProjectPhoto(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    url: str = ""
    analysis: Optional[ProjectPhotoAnalysis] = None


class ProjectStart(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    path: Optional[Literal["inspiration", "photo"]] = None
    photo: Optional[ProjectPhoto] = None


class ProjectSelection(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    inspiration_ids: List[str] = Field(default_factory=list, alias="inspirationIds")
    idea_id: Optional[str] = Field(default=None, alias="ideaId")
    idea_url: Optional[str] = Field(default=None, alias="ideaUrl")
    history: List[str] = Field(default_factory=list)


class ProjectLead(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    email: Optional[str] = None
    phone: Optional[str] = None
    intent: Optional[str] = None


class ProjectEvent(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    type: str
    url: Optional[str] = None
    source: Optional[str] = None
    mode: Optional[str] = None


class ProjectState(BaseModel):
    """
    Canonical project schema for Adventure V7.

    Every step consumes/produces slices of this object. Image intelligence and
    model routing read it; they do not invent step-local state.
    """

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    instance_id: str = Field(default="", alias="instanceId")
    service: ProjectService = Field(default_factory=ProjectService)
    scope: ProjectScope = Field(default_factory=ProjectScope)
    budget: ProjectBudget = Field(default_factory=ProjectBudget)
    start: ProjectStart = Field(default_factory=ProjectStart)
    taste: TasteProfile = Field(default_factory=TasteProfile)
    selection: ProjectSelection = Field(default_factory=ProjectSelection)
    estimate: Optional[Dict[str, Any]] = None
    lead: ProjectLead = Field(default_factory=ProjectLead)
    events: List[ProjectEvent] = Field(default_factory=list)
    refine_note: Optional[str] = Field(default=None, alias="refineNote")
    must_include: List[str] = Field(default_factory=list, alias="mustInclude")
    avoid: List[str] = Field(default_factory=list)
    price_impact: float = Field(default=0.0, alias="priceImpact")

    def scope_joined(self) -> str:
        return self.scope.joined()

    def display_service_label(self) -> str:
        return (
            self.service.customer_label
            or self.service.business_label
            or self.service.id
            or "Project"
        )


class DesignState(BaseModel):
    """
    Pipeline working view of ProjectState.

    Flat fields remain for prompt/pricing adapters; nested `project` is authoritative
    when present. Prefer ProjectState for new code.
    """

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    instance_id: str = Field(default="", alias="instanceId")
    service_id: str = Field(default="", alias="serviceId")
    service_label: str = Field(default="", alias="serviceLabel")
    customer_service_label: str = Field(default="", alias="customerServiceLabel")
    industry: str = ""
    service_summary: str = Field(default="", alias="serviceSummary")
    visual_eligible: bool = Field(default=True, alias="visualEligible")
    # Joined scope string for prompts / legacy callers.
    scope: str = ""
    scopes: List[str] = Field(default_factory=list)
    scope_keys: List[str] = Field(default_factory=list, alias="scopeKeys")
    scope_other: str = Field(default="", alias="scopeOther")
    budget: float = 0
    budget_band_id: Optional[str] = Field(default=None, alias="budgetBandId")
    budget_source: Literal["ai", "business", "customer", "learned"] = Field(
        default="customer", alias="budgetSource"
    )
    budget_confidence: float = Field(default=0.5, alias="budgetConfidence")
    start_path: Optional[str] = Field(default=None, alias="startPath")
    photo_url: Optional[str] = Field(default=None, alias="photoUrl")
    photo_analysis: Optional[Dict[str, Any]] = Field(default=None, alias="photoAnalysis")
    favorite_urls: List[str] = Field(default_factory=list, alias="favoriteUrls")
    taste: TasteProfile = Field(default_factory=TasteProfile)
    selected_idea_url: Optional[str] = Field(default=None, alias="selectedIdeaUrl")
    refine_note: Optional[str] = Field(default=None, alias="refineNote")
    must_include: List[str] = Field(default_factory=list, alias="mustInclude")
    avoid: List[str] = Field(default_factory=list, alias="avoid")
    price_impact: float = Field(default=0.0, alias="priceImpact")
    project: Optional[ProjectState] = None

    @model_validator(mode="after")
    def _sync_scope_fields(self) -> "DesignState":
        if self.scopes and not self.scope:
            self.scope = ", ".join(self.scopes)
        elif self.scope and not self.scopes:
            parts = [p.strip() for p in self.scope.split(",") if p.strip()]
            self.scopes = parts
        if self.scopes and not self.scope_keys:
            self.scope_keys = list(self.scopes)
        return self

    def to_project_state(self) -> ProjectState:
        if self.project is not None:
            return self.project
        items = [
            ProjectScopeItem(key=k, label=lab, source="stored")
            for k, lab in zip(
                self.scope_keys or self.scopes,
                self.scopes or self.scope_keys,
            )
        ]
        if not items and self.scope:
            items = [ProjectScopeItem(key=self.scope, label=self.scope, source="customer")]
        photo = None
        if self.photo_url:
            analysis = None
            if isinstance(self.photo_analysis, dict):
                try:
                    analysis = ProjectPhotoAnalysis.model_validate(self.photo_analysis)
                except Exception:
                    analysis = ProjectPhotoAnalysis(notes=str(self.photo_analysis)[:500])
            photo = ProjectPhoto(url=self.photo_url, analysis=analysis)
        path = self.start_path if self.start_path in ("inspiration", "photo") else None
        return ProjectState(
            instanceId=self.instance_id,
            service=ProjectService(
                id=self.service_id,
                businessLabel=self.service_label,
                customerLabel=self.customer_service_label or self.service_label,
                industry=self.industry,
                summary=self.service_summary,
                visualEligible=self.visual_eligible,
            ),
            scope=ProjectScope(
                items=items,
                otherText=self.scope_other,
                mode="multi",
            ),
            budget=ProjectBudget(
                amount=float(self.budget or 0),
                bandId=self.budget_band_id,
                source=self.budget_source,
                confidence=self.budget_confidence,
            ),
            start=ProjectStart(path=path, photo=photo),  # type: ignore[arg-type]
            taste=self.taste,
            selection=ProjectSelection(
                ideaUrl=self.selected_idea_url,
                inspirationIds=[],
                history=[],
            ),
            refineNote=self.refine_note,
            mustInclude=list(self.must_include),
            avoid=list(self.avoid),
            priceImpact=float(self.price_impact or 0),
        )


class Modification(BaseModel):
    """Structured reading of one plain-language design request."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    intent: str = "other"
    must_include: List[str] = Field(default_factory=list, alias="mustInclude")
    avoid: List[str] = Field(default_factory=list)
    keep: List[str] = Field(default_factory=list)
    budget_direction: Literal["down", "up", "hold"] = Field(default="hold", alias="budgetDirection")
    budget_delta_pct: float = Field(default=0.0, alias="budgetDeltaPct")
    summary: str = ""
    source: Literal["llm", "rules"] = "rules"


class GenerationSpec(BaseModel):
    """
    Orchestrator output before image generation.
    Compiles into the existing ImagePromptSpec / generate_image payload — does not replace it.
    """

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    project_context: str = Field(default="", alias="projectContext")
    visual_style: List[str] = Field(default_factory=list, alias="visualStyle")
    materials: List[str] = Field(default_factory=list)
    composition: str = ""
    constraints: List[str] = Field(default_factory=list)
    budget_target: float = Field(default=0, alias="budgetTarget")
    must_include: List[str] = Field(default_factory=list, alias="mustInclude")
    avoid: List[str] = Field(default_factory=list)
    instruction: str = ""
    mode: Literal["inspiration", "ideas", "refine", "final"] = "ideas"
    num_outputs: int = Field(default=8, alias="numOutputs")
    reference_images: List[str] = Field(default_factory=list, alias="referenceImages")

    def to_image_payload(self, *, instance_id: str, design: DesignState) -> Dict[str, Any]:
        """Map into the existing generate_image contract (scene use-case)."""
        style = ", ".join(self.visual_style[:8]) if self.visual_style else "clean contemporary"
        materials = ", ".join(self.materials[:8]) if self.materials else "high-quality finishes"
        must = ", ".join(self.must_include[:8]) if self.must_include else "cohesive design"
        avoid = ", ".join(self.avoid[:8]) if self.avoid else "clutter, text overlays, watermark"
        intent = self.instruction or (
            f"{self.project_context}. Style: {style}. Materials: {materials}. "
            f"Include: {must}. Avoid: {avoid}. Budget around ${int(self.budget_target or 0)}."
        )
        restyle_photo = self.mode == "ideas" and bool(design.photo_url)
        use_case = (
            "scene-refinement"
            if (self.mode in ("refine", "final") and design.selected_idea_url) or restyle_photo
            else "scene"
        )
        scene = None
        if use_case == "scene-refinement":
            scene = design.selected_idea_url if self.mode in ("refine", "final") else design.photo_url

        refs = list(self.reference_images)
        if scene:
            refs = [u for u in refs if u != scene][:4]
        elif design.photo_url and design.photo_url not in refs:
            refs = [design.photo_url, *refs][:4]
        if design.selected_idea_url and self.mode in ("refine", "final"):
            refs = [design.selected_idea_url, *[u for u in refs if u != design.selected_idea_url]][:4]

        service = design.customer_service_label or design.service_label or design.service_id
        scope_text = design.scope or ", ".join(design.scopes) or "General"
        return {
            "instanceId": instance_id or design.instance_id,
            "useCase": use_case,
            "industry": design.industry or service,
            "service": service,
            "serviceSummary": design.service_summary or f"{service} — {scope_text}".strip(" —"),
            "numOutputs": max(1, min(int(self.num_outputs or 1), 9)),
            "generationIntent": self.mode,
            "refinementNotes": intent,
            "referenceImages": refs,
            "sceneImage": scene,
            "stepDataSoFar": {
                "service": service,
                "scope": scope_text,
                "scopes": design.scopes,
                "scopeKeys": design.scope_keys,
                "budget": design.budget,
                "taste": [
                    t.label
                    for t in design.taste.tags
                    if t.id in (design.taste.confirmed_ids or [t.id for t in design.taste.tags])
                ],
                "generationSpec": self.model_dump(by_alias=True),
                "photoAnalysis": design.photo_analysis,
            },
            "answeredQA": [
                {"question": "Service", "answer": service},
                {"question": "Scope", "answer": scope_text},
                {"question": "Budget", "answer": str(int(design.budget or 0))},
            ],
        }


def project_from_payload(raw: Dict[str, Any]) -> ProjectState:
    """Accept nested ProjectState or legacy flat design payloads."""
    body = raw if isinstance(raw, dict) else {}
    # Nested project wins when present.
    if isinstance(body.get("project"), dict):
        try:
            return ProjectState.model_validate(body.get("project"))
        except Exception:
            pass
    if isinstance(body.get("service"), dict) and (
        "scope" in body and isinstance(body.get("scope"), dict)
    ):
        try:
            return ProjectState.model_validate(body)
        except Exception:
            pass

    # Legacy / flat
    taste_raw = body.get("taste") if isinstance(body.get("taste"), dict) else {}
    tags: List[TasteTag] = []
    for i, t in enumerate(taste_raw.get("tags") or []):
        if not isinstance(t, dict):
            continue
        try:
            tags.append(TasteTag.model_validate(t))
        except Exception:
            label = str(t.get("label") or "").strip()
            if not label:
                continue
            tags.append(
                TasteTag(
                    id=str(t.get("id") or f"taste-{i + 1}"),
                    label=label,
                    attributePath=str(t.get("attributePath") or t.get("attribute_path") or ""),
                    imageUrl=str(t.get("imageUrl") or t.get("image_url") or ""),
                    focalX=float(t.get("focalX") or t.get("focal_x") or 50),
                    focalY=float(t.get("focalY") or t.get("focal_y") or 50),
                    selected=bool(t.get("selected", True)),
                )
            )
    confirmed = taste_raw.get("confirmedIds") or taste_raw.get("confirmed_ids")
    if not isinstance(confirmed, list):
        confirmed = [t.id for t in tags if t.selected]

    scope_items: List[ProjectScopeItem] = []
    scope_obj = body.get("scope")
    if isinstance(scope_obj, dict) and isinstance(scope_obj.get("items"), list):
        for item in scope_obj["items"]:
            if isinstance(item, dict):
                try:
                    scope_items.append(ProjectScopeItem.model_validate(item))
                except Exception:
                    label = str(item.get("label") or "").strip()
                    if label:
                        scope_items.append(
                            ProjectScopeItem(
                                key=str(item.get("key") or label),
                                label=label,
                                source="customer",
                            )
                        )
    else:
        scopes_raw = body.get("scopes") or body.get("scopeKeys") or body.get("scope_keys")
        if isinstance(scopes_raw, list):
            for s in scopes_raw:
                label = str(s or "").strip()
                if label:
                    scope_items.append(ProjectScopeItem(key=label, label=label, source="customer"))
        elif isinstance(scope_obj, str) and scope_obj.strip():
            for part in scope_obj.split(","):
                label = part.strip()
                if label:
                    scope_items.append(ProjectScopeItem(key=label, label=label, source="customer"))

    other = ""
    if isinstance(scope_obj, dict):
        other = str(scope_obj.get("otherText") or scope_obj.get("other_text") or "").strip()
    other = other or str(body.get("scopeOther") or body.get("otherScope") or body.get("scope_other") or "").strip()

    budget_raw = body.get("budget")
    if isinstance(budget_raw, dict):
        budget = ProjectBudget.model_validate(budget_raw)
    else:
        src = str(body.get("budgetSource") or body.get("budget_source") or "customer").lower()
        if src not in ("ai", "business", "customer", "learned"):
            src = "customer"
        budget = ProjectBudget(
            amount=float(budget_raw or 0),
            bandId=body.get("budgetBandId") or body.get("budget_band_id"),
            source=src,  # type: ignore[arg-type]
            confidence=float(body.get("budgetConfidence") or body.get("budget_confidence") or 0.5),
        )

    start_raw = body.get("start") if isinstance(body.get("start"), dict) else {}
    path = start_raw.get("path") or body.get("startPath") or body.get("start_path")
    if path not in ("inspiration", "photo"):
        path = None
    photo_url = None
    photo_analysis = None
    if isinstance(start_raw.get("photo"), dict):
        photo_url = start_raw["photo"].get("url")
        photo_analysis = start_raw["photo"].get("analysis")
    photo_url = photo_url or body.get("photoUrl") or body.get("photo_url")
    photo_analysis = photo_analysis or body.get("photoAnalysis") or body.get("photo_analysis")
    photo = None
    if photo_url:
        analysis = None
        if isinstance(photo_analysis, dict):
            try:
                analysis = ProjectPhotoAnalysis.model_validate(photo_analysis)
            except Exception:
                analysis = None
        photo = ProjectPhoto(url=str(photo_url), analysis=analysis)

    service_raw = body.get("service") if isinstance(body.get("service"), dict) else {}
    business = str(
        service_raw.get("businessLabel")
        or service_raw.get("business_label")
        or body.get("serviceLabel")
        or body.get("service_label")
        or ""
    ).strip()
    customer = str(
        service_raw.get("customerLabel")
        or service_raw.get("customer_label")
        or body.get("customerServiceLabel")
        or body.get("customer_service_label")
        or business
    ).strip()

    favorites: List[str] = []
    for item in body.get("favoriteUrls") or body.get("favorite_urls") or []:
        if isinstance(item, str) and item.strip():
            favorites.append(item.strip())
        elif isinstance(item, dict):
            u = str(item.get("url") or "").strip()
            if u:
                favorites.append(u)

    selection_raw = body.get("selection") if isinstance(body.get("selection"), dict) else {}
    idea_url = (
        selection_raw.get("ideaUrl")
        or selection_raw.get("idea_url")
        or body.get("selectedIdeaUrl")
        or body.get("selected_idea_url")
    )

    lead_raw = body.get("lead") if isinstance(body.get("lead"), dict) else {}
    source_taste = str(taste_raw.get("source") or "ontology").strip().lower()
    if source_taste not in ("ontology", "vision", "hybrid"):
        source_taste = "ontology"

    return ProjectState(
        instanceId=str(body.get("instanceId") or body.get("instance_id") or "").strip(),
        service=ProjectService(
            id=str(service_raw.get("id") or body.get("serviceId") or body.get("service_id") or "").strip(),
            businessLabel=business,
            customerLabel=customer,
            industry=str(service_raw.get("industry") or body.get("industry") or "").strip(),
            summary=str(
                service_raw.get("summary")
                or body.get("serviceSummary")
                or body.get("service_summary")
                or ""
            ).strip()[:1200],
            visualEligible=bool(
                service_raw.get("visualEligible")
                if service_raw.get("visualEligible") is not None
                else body.get("visualEligible", True)
            ),
        ),
        scope=ProjectScope(items=scope_items, otherText=other, mode="multi"),
        budget=budget,
        start=ProjectStart(path=path, photo=photo),  # type: ignore[arg-type]
        taste=TasteProfile(
            tags=tags,
            confirmedIds=[str(x) for x in confirmed if str(x).strip()],
            source=source_taste,  # type: ignore[arg-type]
        ),
        selection=ProjectSelection(
            inspirationIds=list(selection_raw.get("inspirationIds") or favorites),
            ideaId=selection_raw.get("ideaId") or selection_raw.get("idea_id"),
            ideaUrl=idea_url,
            history=list(selection_raw.get("history") or []),
        ),
        estimate=body.get("estimate") if isinstance(body.get("estimate"), dict) else None,
        lead=ProjectLead(
            email=lead_raw.get("email") or body.get("email"),
            phone=lead_raw.get("phone") or body.get("phone"),
            intent=lead_raw.get("intent") or body.get("connectIntent"),
        ),
        refineNote=body.get("refineNote") or body.get("refine_note"),
        mustInclude=list(body.get("mustInclude") or body.get("must_include") or []),
        avoid=list(body.get("avoid") or []),
        priceImpact=float(body.get("priceImpact") or body.get("price_impact") or 0),
    )


def design_from_project(project: ProjectState) -> DesignState:
    labels = project.scope.labels()
    keys = project.scope.keys() or labels
    photo_url = project.start.photo.url if project.start.photo else None
    photo_analysis = (
        project.start.photo.analysis.model_dump(by_alias=True)
        if project.start.photo and project.start.photo.analysis
        else None
    )
    return DesignState(
        instanceId=project.instance_id,
        serviceId=project.service.id,
        serviceLabel=project.service.business_label or project.service.customer_label,
        customerServiceLabel=project.service.customer_label or project.service.business_label,
        industry=project.service.industry,
        serviceSummary=project.service.summary,
        visualEligible=project.service.visual_eligible,
        scope=project.scope_joined(),
        scopes=labels,
        scopeKeys=keys,
        scopeOther=project.scope.other_text,
        budget=float(project.budget.amount or 0),
        budgetBandId=project.budget.band_id,
        budgetSource=project.budget.source,
        budgetConfidence=project.budget.confidence,
        startPath=project.start.path,
        photoUrl=photo_url,
        photoAnalysis=photo_analysis,
        favoriteUrls=list(project.selection.inspiration_ids),
        taste=project.taste,
        selectedIdeaUrl=project.selection.idea_url,
        refineNote=project.refine_note,
        mustInclude=list(project.must_include),
        avoid=list(project.avoid),
        priceImpact=float(project.price_impact or 0),
        project=project,
    )


__all__ = [
    "TasteTag",
    "TasteProfile",
    "ProjectService",
    "ProjectScopeItem",
    "ProjectScope",
    "ProjectBudget",
    "ProjectPhotoAnalysis",
    "ProjectPhoto",
    "ProjectStart",
    "ProjectSelection",
    "ProjectLead",
    "ProjectEvent",
    "ProjectState",
    "DesignState",
    "Modification",
    "GenerationSpec",
    "project_from_payload",
    "design_from_project",
]
