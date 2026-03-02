"""
Safe expression evaluation, type coercion from declarations, and template interpolation.
Used by both slot_filling_engine and context_action_engine.
"""
import re
import math
from typing import Any, Dict, List, Optional

# Whitelisted builtins for eval - no open, exec, __import__, etc.
_SAFE_BUILTINS: Dict[str, Any] = {
    "abs": abs,
    "min": min,
    "max": max,
    "sum": sum,
    "round": round,
    "int": int,
    "float": float,
    "str": str,
    "bool": bool,
    "len": len,
    "None": None,
    "True": True,
    "False": False,
    "re": re,
    "math": math,
}


def safe_eval(expression: str, scope: Dict[str, Any]) -> Any:
    """
    Evaluate a Python expression in a restricted environment.
    scope provides variable names (slot values, etc.); re and safe builtins are allowed.
    """
    globals_dict = {**_SAFE_BUILTINS}
    locals_dict = dict(scope)
    return eval(expression, globals_dict, locals_dict)


def coerce_value(raw: Any, type_spec: Any) -> Any:
    """
    Coerce a value to the declared type.
    type_spec can be int, "int", float, "float", str, "str", etc.
    """
    if type_spec is None:
        return raw
    t = type_spec if isinstance(type_spec, type) else _type_from_string(type_spec)
    if t is int:
        if isinstance(raw, int):
            return raw
        s = str(raw).strip()
        return int(s) if s else 0
    if t is float:
        if isinstance(raw, (int, float)):
            return float(raw)
        s = str(raw).strip().replace(",", "")
        return float(s) if s else 0.0
    if t is str:
        return str(raw) if raw is not None else ""
    if t is bool:
        if isinstance(raw, bool):
            return raw
        s = str(raw).strip().lower()
        return s in ("yes", "true", "1")
    return raw


def _type_from_string(name: str) -> type:
    n = (name or "").strip().lower()
    if n in ("int", "integer"):
        return int
    if n in ("float", "number"):
        return float
    if n in ("str", "string"):
        return str
    if n in ("bool", "boolean"):
        return bool
    return str


def apply_declarations(
    declarations: List[Dict[str, Any]],
    incoming: Dict[str, Any],
    current_state: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Build scope from declarations: apply type and default_value, override with incoming.
    For slot-filling, current_state is the accumulated state and we set the current slot from incoming.
    For context-action, incoming is the tool call args and we merge with defaults.
    """
    scope: Dict[str, Any] = {}
    if current_state:
        scope.update(current_state)

    declared_names = set()
    for decl in declarations or []:
        name = decl.get("name")
        if not name:
            continue
        declared_names.add(name)
        type_spec = decl.get("type", str)
        default = decl.get("default_value")
        value = incoming.get(name)
        if value is None or (isinstance(value, str) and value.strip() == ""):
            value = default
        scope[name] = coerce_value(value, type_spec)

    # Add incoming keys not in declarations (e.g. name/value for slot-filling) without overwriting coerced values
    for k, v in incoming.items():
        if v is not None and (not isinstance(v, str) or v.strip() != ""):
            if k in declared_names:
                continue  # already set with coercion above
            scope[k] = v
    return scope


def interpolate_template(template: str, scope: Dict[str, Any], decimal_places: int = 2) -> str:
    """
    Replace {var_name} in template with scope[var_name].
    Format floats with decimal_places for currency-style output.
    """
    if not template:
        return template

    def repl(match: re.Match) -> str:
        key = match.group(1).strip()
        val = scope.get(key)
        if val is None:
            return ""
        if isinstance(val, float):
            return f"{round(val, decimal_places):.{decimal_places}f}"
        if isinstance(val, bool):
            return "True" if val else "False"
        return str(val)

    return re.sub(r"\{(\w+)\}", repl, template)
