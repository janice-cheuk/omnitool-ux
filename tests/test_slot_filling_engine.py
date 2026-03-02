"""Unit tests for slot-filling engine: type consistency, phone regex, empty conditions, branching."""
import pytest
from backend.slot_filling_engine import run_slot_filling_engine


# Minimal fixedArgs mirroring omnitools-demo.yaml structure
SLOT_FILLING_FIXED_ARGS = {
    "actions_by_name": {
        "user_intent": {
            "required_slots": [],
            "declarations": [],
            "validations": [
                {
                    "expression": "user_intent in ['new_service', 'transfer_service', 'stop_service', 'pending']",
                    "failure_message": "Error: invalid input, must be one of the following: new_service, transfer_service, stop_service, pending.",
                }
            ],
            "transformations": [],
            "conditional_actions": [
                {
                    "conditions": [{"name": "user_intent", "condition": "matches", "value": "new_service"}],
                    "tool_msg": "Collect is_residential_service: ask whether the service is for residential or commercial.",
                },
                {
                    "conditions": [{"name": "user_intent", "condition": "matches", "value": "transfer_service"}],
                    "tool_msg": "Tell the user that they will be routed to the transfer queue. Do not ask further questions.",
                },
                {
                    "conditions": [{"name": "user_intent", "condition": "matches", "value": "stop_service"}],
                    "tool_msg": "Tell the user that they will be routed to the move out queue. Do not ask further questions.",
                },
                {
                    "conditions": [{"name": "user_intent", "condition": "matches", "value": "pending"}],
                    "tool_msg": "Tell the user that they will be routed to the retention queue. Do not ask further questions.",
                },
            ],
        },
        "age": {
            "required_slots": ["is_residential_service"],
            "declarations": [{"name": "age", "type": int}],
            "validations": [],
            "transformations": [
                {"name": "age_over_18", "expression": "age > 18", "output_slot_key": "age_over_18"}
            ],
            "conditional_actions": [
                {
                    "conditions": [{"name": "age_over_18", "condition": "matches", "value": "False"}],
                    "tool_msg": "Stop collecting information, ask for a caller who is over 18 years old.",
                },
                {"conditions": [], "tool_msg": "Collect is_account_holder: ask if the caller is the account holder."},
            ],
        },
        "phone_number": {
            "required_slots": ["account_holder_full_name"],
            "declarations": [],
            "validations": [
                {
                    "expression": "re.match(r'^[0-9]{10}$', phone_number.replace('-', '').replace(' ', '')) is not None",
                    "failure_message": "Error: invalid phone number. Please enter a valid 10-digit phone number.",
                }
            ],
            "transformations": [],
            "conditional_actions": [
                {"conditions": [], "tool_msg": "All information collected, thank the user for their information."}
            ],
        },
    }
}


def test_slot_filling_user_intent_new_service():
    result = run_slot_filling_engine(
        SLOT_FILLING_FIXED_ARGS,
        name="user_intent",
        value="new_service",
        state={},
    )
    assert result["success"] is True
    assert "is_residential_service" in result["tool_msg"]
    assert result["state"]["user_intent"] == "new_service"
    assert result["stop_collection"] is False


def test_slot_filling_user_intent_transfer_stop_collection():
    result = run_slot_filling_engine(
        SLOT_FILLING_FIXED_ARGS,
        name="user_intent",
        value="transfer_service",
        state={},
    )
    assert result["success"] is True
    assert "transfer queue" in result["tool_msg"]
    assert "Do not ask further questions" in result["tool_msg"]
    assert result["stop_collection"] is True


def test_slot_filling_type_consistency_age_int():
    """Age is declared as int; expression age > 18 must see an integer."""
    state = {"user_intent": "new_service", "is_residential_service": "yes"}
    result = run_slot_filling_engine(
        SLOT_FILLING_FIXED_ARGS,
        name="age",
        value="25",
        state=state,
    )
    assert result["success"] is True
    assert result["state"]["age"] == 25
    assert result["state"]["age_over_18"] is True
    assert "is_account_holder" in result["tool_msg"]


def test_slot_filling_age_under_18_branch():
    """age_over_18 False -> 'Stop collecting information' branch."""
    state = {"user_intent": "new_service", "is_residential_service": "yes"}
    result = run_slot_filling_engine(
        SLOT_FILLING_FIXED_ARGS,
        name="age",
        value="17",
        state=state,
    )
    assert result["success"] is True
    assert result["state"]["age_over_18"] is False
    assert "over 18" in result["tool_msg"]


def test_slot_filling_empty_conditions_default():
    """Empty conditions list acts as default (last branch that matches)."""
    state = {"user_intent": "new_service", "is_residential_service": "yes"}
    result = run_slot_filling_engine(
        SLOT_FILLING_FIXED_ARGS,
        name="age",
        value="20",
        state=state,
    )
    assert result["success"] is True
    assert "is_account_holder" in result["tool_msg"]


def test_slot_filling_phone_validation_regex():
    """Phone must be 10 digits; re is in scope; replace('-','') applied."""
    state = {"account_holder_full_name": "Jane Doe"}
    result = run_slot_filling_engine(
        SLOT_FILLING_FIXED_ARGS,
        name="phone_number",
        value="555-123-4567",
        state=state,
    )
    assert result["success"] is True
    assert "All information collected" in result["tool_msg"]


def test_slot_filling_phone_invalid_fails():
    state = {"account_holder_full_name": "Jane"}
    result = run_slot_filling_engine(
        SLOT_FILLING_FIXED_ARGS,
        name="phone_number",
        value="123",
        state=state,
    )
    assert result["success"] is False
    assert "invalid phone number" in result["tool_msg"].lower()


def test_slot_filling_required_slots_enforced():
    """age requires is_residential_service in state."""
    result = run_slot_filling_engine(
        SLOT_FILLING_FIXED_ARGS,
        name="age",
        value="25",
        state={},
    )
    assert result["success"] is False
    assert "required" in result["tool_msg"].lower() or "Missing" in result["tool_msg"]


def test_slot_filling_validation_failure_user_intent():
    result = run_slot_filling_engine(
        SLOT_FILLING_FIXED_ARGS,
        name="user_intent",
        value="invalid_intent",
        state={},
    )
    assert result["success"] is False
    assert "invalid" in result["tool_msg"].lower()
