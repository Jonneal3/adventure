#!/usr/bin/env python3
"""
Backward-compatibility shim: run `python -m optimizers.optimize_question_planner`
to invoke the Question Planner optimizer.
"""
from programs.question_planner.optimizers.optimize_question_planner import main
import sys

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
