from datetime import date
from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr, StringConstraints, field_validator

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Credentials(Input):
    email: EmailStr
    password: SecretStr = Field(min_length=1, max_length=128)


class Profile(Input):
    name: Name
    timezone: str = Field(max_length=64)

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Choose a valid IANA time zone") from None
        return value


class Registration(Credentials, Profile):
    password: SecretStr = Field(min_length=12, max_length=128)


class Period(Input):
    start: date
    end: date | None = None


Mood = Literal["Happy", "Calm", "Tired", "Low", "Irritable", "Anxious", "Unspecified"]
Symptom = Literal["Cramps", "Headache", "Bloating", "Acne", "Fatigue", "Tender breasts", "Back pain"]


class Checkin(Input):
    mood: Mood
    symptoms: list[Symptom] = Field(max_length=7)


class PasswordConfirmation(Input):
    password: SecretStr = Field(min_length=1, max_length=128)
