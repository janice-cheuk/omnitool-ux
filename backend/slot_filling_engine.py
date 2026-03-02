"""
Slot-filling engine: executes actions_by_name from fixedArgs.
Applies declarations, validations, transformations, conditional_actions per slot;
returns tool_msg and updated state.
"""
from typing import Any, Dict, List, Optional

from .eval_utils import (
    apply_declarations,
    safe_eval,
    interpolate_template,
)


def _condition_matches(condition_spec: Dict[str, Any], state: Dict[str, Any]) -> bool:
    """Check one condition: name, condition (e.g. 'matches'), value."""
    name = condition_spec.get("name")
    cond = (condition_spec.get("condition") or "matches").strip().lower()
    expected = condition_spec.get("value")
    actual = state.get(name)
    # Normalize for comparison: bool -> "True"/"False" so YAML value "True"/"False" matches
    if isinstance(actual, bool):
        actual_str = "True" if actual else "False"
    else:
        actual_str = str(actual) if actual is not None else ""
    expected_str = str(expected) if expected is not None else ""
    if cond == "matches":
        return actual_str == expected_str
    return False


def _evaluate_conditional_actions(
    conditional_actions: List[Dict[str, Any]],
    state: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """
    First-match wins. Empty conditions list = default (matches when no prior matched).
    Returns the matched action dict (tool_msg, etc.) or None.
    """
    for action in conditional_actions or []:
        conditions = action.get("conditions") or []
        if len(conditions) == 0:
            return action
        if all(_condition_matches(c, state) for c in conditions):
            return action
    return None


def run_slot_filling_engine(
    fixed_args: Dict[str, Any],
    name: str,
    value: Any,
    state: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Run the slot-filling engine for one tool call (name, value).
    fixed_args must contain actions_by_name (slot name -> action config).
    state is the accumulated slot state from previous turns.
    Returns dict with: success, tool_msg, state, stop_collection (optional).
    """
    state = dict(state or {})
    actions_by_name = fixed_args.get("actions_by_name") or {}
    action = actions_by_name.get(name)
    if not action:
        return {
            "success": False,
            "tool_msg": f"Unknown slot: {name}.",
            "state": state,
            "stop_collection": False,
        }

    # 1. Check required_slots
    required = action.get("required_slots") or []
    for req in required:
        if req not in state:
            return {
                "success": False,
                "tool_msg": f"Missing required slot: {req}. Collect it first.",
                "state": state,
                "stop_collection": False,
            }

    # 2. Merge current slot into state and apply declarations
    incoming = {name: value}
    declarations = action.get("declarations") or []
    scope = apply_declarations(declarations, incoming, state)
    # Ensure the slot we're filling is in state with coerced value
    state[name] = scope.get(name, value)

    # 3. Validations (run in scope that has state + current slot)
    eval_scope = dict(state)
    eval_scope[name] = scope.get(name, value)
    for decl in declarations:
        n = decl.get("name")
        if n is not None and n in scope:
            eval_scope[n] = scope[n]
    for val in action.get("validations") or []:
        expr = val.get("expression")
        if not expr:
            continue
        try:
            if not safe_eval(expr, eval_scope):
                failure_msg = val.get("failure_message") or "Validation failed."
                return {
                    "success": False,
                    "tool_msg": interpolate_template(failure_msg, eval_scope),
                    "state": state,
                    "stop_collection": False,
                }
        except Exception as e:
            return {
                "success": False,
                "tool_msg": f"Validation error: {e}",
                "state": state,
                "stop_collection": False,
            }

    # 4. Transformations (update state with derived slots)
    for t in action.get("transformations") or []:
        expr = t.get("expression")
        if not expr:
            continue
        try:
            result = safe_eval(expr, eval_scope)
            out_key = t.get("output_slot_key")
            t_name = t.get("name")
            if t_name:
                eval_scope[t_name] = result
                state[t_name] = result
            if out_key:
                eval_scope[out_key] = result
                state[out_key] = result
        except Exception as e:
            return {
                "success": False,
                "tool_msg": f"Transformation error: {e}",
                "state": state,
                "stop_collection": False,
            }

    # 5. Conditional actions (first-match; empty = default)
    matched = _evaluate_conditional_actions(
        action.get("conditional_actions") or [],
        eval_scope,
    )
    if not matched:
        return {
            "success": True,
            "tool_msg": "No next step defined.",
            "state": state,
            "stop_collection": False,
        }

    tool_msg = matched.get("tool_msg") or ""
    tool_msg = interpolate_template(tool_msg, eval_scope)
    stop_phrase = "do not ask further questions"
    stop_collection = stop_phrase in (tool_msg or "").lower()

    return {
        "success": True,
        "tool_msg": tool_msg,
        "state": state,
        "stop_collection": stop_collection,
    }
