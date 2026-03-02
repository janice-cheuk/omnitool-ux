"""
Context-action engine: single-turn execution of declarations, validations,
transformations, and conditional_actions from fixedArgs.
Returns tool_msg, message, next_turn_mode with template substitution.
"""
from typing import Any, Dict, List, Optional

from .eval_utils import (
    apply_declarations,
    safe_eval,
    interpolate_template,
)
from .slot_filling_engine import _condition_matches, _evaluate_conditional_actions


def run_context_action_engine(
    fixed_args: Dict[str, Any],
    tool_call_args: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Run the context-action engine for one tool call.
    fixed_args must contain declarations, validations, transformations, conditional_actions.
    tool_call_args are the tool parameters (e.g. user_input, agent_message, conversation_summary).
    Returns dict with: success, tool_msg, message (optional), next_turn_mode (optional).
    """
    # 1. Declarations: build scope with types and defaults, override with tool_call_args
    declarations = fixed_args.get("declarations") or []
    scope = apply_declarations(declarations, tool_call_args, current_state=None)

    # 2. Validations
    for val in fixed_args.get("validations") or []:
        expr = val.get("expression")
        if not expr:
            continue
        try:
            if not safe_eval(expr, scope):
                failure_msg = val.get("failure_message") or "Validation failed."
                return {
                    "success": False,
                    "tool_msg": interpolate_template(failure_msg, scope),
                    "message": None,
                    "next_turn_mode": None,
                }
        except Exception as e:
            return {
                "success": False,
                "tool_msg": f"Validation error: {e}",
                "message": None,
                "next_turn_mode": None,
            }

    # 3. Transformations (each can use previous; store under name and optionally output_slot_key)
    for t in fixed_args.get("transformations") or []:
        expr = t.get("expression")
        if not expr:
            continue
        try:
            result = safe_eval(expr, scope)
            t_name = t.get("name")
            out_key = t.get("output_slot_key")
            if t_name:
                scope[t_name] = result
            if out_key:
                scope[out_key] = result
        except Exception as e:
            return {
                "success": False,
                "tool_msg": f"Transformation error: {e}",
                "message": None,
                "next_turn_mode": None,
            }

    # 4. Conditional actions (first-match; empty = default)
    matched = _evaluate_conditional_actions(
        fixed_args.get("conditional_actions") or [],
        scope,
    )
    if not matched:
        return {
            "success": True,
            "tool_msg": "",
            "message": None,
            "next_turn_mode": None,
        }

    tool_msg = matched.get("tool_msg") or ""
    tool_msg = interpolate_template(tool_msg, scope)
    message = matched.get("message")
    if message is not None:
        message = interpolate_template(str(message), scope)
    next_turn_mode = matched.get("next_turn_mode")

    return {
        "success": True,
        "tool_msg": tool_msg,
        "message": message,
        "next_turn_mode": next_turn_mode,
    }
