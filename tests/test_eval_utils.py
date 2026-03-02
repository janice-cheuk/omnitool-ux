"""Tests for eval_utils: safe_eval, type coercion, template interpolation."""
import pytest
from backend.eval_utils import (
    safe_eval,
    coerce_value,
    apply_declarations,
    interpolate_template,
)


def test_safe_eval_re_in_scope():
    scope = {"phone_number": "1234567890"}
    assert safe_eval("re.match(r'^[0-9]{10}$', phone_number) is not None", scope) is True


def test_safe_eval_math():
    scope = {"x": 10, "y": 3}
    assert safe_eval("x > 18", scope) is False
    assert safe_eval("x + y", scope) == 13


def test_coerce_value_int():
    assert coerce_value("25", int) == 25
    assert coerce_value("25", "int") == 25


def test_coerce_value_float():
    assert coerce_value("10.5", float) == 10.5
    assert coerce_value("10", "float") == 10.0


def test_apply_declarations_with_type():
    declarations = [{"name": "age", "type": int, "default_value": None}]
    incoming = {"age": "22"}
    state = {}
    scope = apply_declarations(declarations, incoming, state)
    assert scope["age"] == 22


def test_interpolate_template():
    scope = {"payment_amount": 5.5, "remaining_balance": 4.5}
    t = "You will pay {payment_amount}, remaining balance is {remaining_balance}."
    out = interpolate_template(t, scope)
    assert "5.50" in out
    assert "4.50" in out


def test_interpolate_template_bool():
    scope = {"flag": True}
    assert "True" in interpolate_template("{flag}", scope)
