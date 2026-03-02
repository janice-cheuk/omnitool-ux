"""Unit tests for context-action engine: overpaid, remaining_balance, message templates."""
import pytest
from backend.context_action_engine import run_context_action_engine


# fixedArgs mirroring omnitools-demo2.yaml
CONTEXT_ACTION_FIXED_ARGS = {
    "declarations": [
        {"name": "user_input", "type": "str", "default_value": ""},
        {"name": "agent_message", "type": "str", "default_value": ""},
        {"name": "conversation_summary", "type": "str", "default_value": ""},
        {"name": "account_balance", "type": "float", "default_value": "10"},
    ],
    "validations": [
        {
            "expression": "re.search(r'[0-9,.]+', user_input) is not None",
            "failure_message": "Error: invalid payment amount {user_input}. Please enter a valid payment amount.",
        }
    ],
    "transformations": [
        {
            "name": "payment_amount",
            "expression": "float(re.search(r'[0-9,.]+', user_input).group(0))",
            "output_slot_key": "payment_amount",
        },
        {"name": "is_overpaid", "expression": "payment_amount > account_balance"},
        {
            "name": "remaining_balance",
            "expression": "account_balance if is_overpaid else account_balance - payment_amount",
            "output_slot_key": "account_balance",
        },
        {"name": "has_remaining_balance", "expression": "remaining_balance > 0"},
    ],
    "conditional_actions": [
        {
            "conditions": [{"name": "is_overpaid", "condition": "matches", "value": "True"}],
            "tool_msg": "User will overpaid. The amount is greater than the account balance {account_balance}. Ask user to pay a different amount.",
            "next_turn_mode": "immediate",
        },
        {
            "conditions": [{"name": "has_remaining_balance", "condition": "matches", "value": "True"}],
            "tool_msg": "payment amount is valid, say 'thank you for your payment.' in the next turn.",
            "next_turn_mode": "immediate",
            "message": "You will pay {payment_amount}, remaining balance is {remaining_balance}.",
        },
        {
            "conditions": [],
            "tool_msg": "payment amount is valid, say 'thank you for your payment.' in the next turn.",
            "next_turn_mode": "immediate",
            "message": "You will pay {payment_amount}, you have no remaining balance.",
        },
    ],
}


def test_context_action_valid_payment_under_balance():
    result = run_context_action_engine(
        CONTEXT_ACTION_FIXED_ARGS,
        {"user_input": "5"},
    )
    assert result["success"] is True
    assert "thank you" in result["tool_msg"].lower()
    assert result["next_turn_mode"] == "immediate"
    assert result["message"] is not None
    assert "5.00" in result["message"]
    assert "remaining balance" in result["message"].lower() or "5.00" in result["message"]


def test_context_action_overpaid_branch():
    result = run_context_action_engine(
        CONTEXT_ACTION_FIXED_ARGS,
        {"user_input": "15"},
    )
    assert result["success"] is True
    assert "overpaid" in result["tool_msg"].lower() or "greater than" in result["tool_msg"].lower()
    assert result["next_turn_mode"] == "immediate"


def test_context_action_full_payment_no_remaining_balance():
    """Pay exactly 10 -> no remaining balance -> default branch with 'no remaining balance' message."""
    result = run_context_action_engine(
        CONTEXT_ACTION_FIXED_ARGS,
        {"user_input": "10"},
    )
    assert result["success"] is True
    assert result["message"] is not None
    assert "no remaining balance" in result["message"].lower()


def test_context_action_template_interpolation():
    result = run_context_action_engine(
        CONTEXT_ACTION_FIXED_ARGS,
        {"user_input": "3.50"},
    )
    assert result["success"] is True
    assert "3.50" in result["message"]
    assert "remaining balance" in result["message"].lower()


def test_context_action_validation_failure_no_number():
    result = run_context_action_engine(
        CONTEXT_ACTION_FIXED_ARGS,
        {"user_input": "I want to pay"},
    )
    assert result["success"] is False
    assert "invalid" in result["tool_msg"].lower() or "Error" in result["tool_msg"]
