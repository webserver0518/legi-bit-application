# app/managers/json_management.py
import json
from pathlib import Path
from flask import jsonify


class JSONManager:
    """
    Utility class for loading predefined JSON data lists from data/jsons directory.
    """

    _base_path = Path(__file__).resolve().parent.parent / "data" / "jsons"

    @classmethod
    def load(cls, filename: str):
        """
        Load a JSON file by name (without path).
        Example: JSONManager.load("roles.json")
        """
        file_path = cls._base_path / filename

        if not file_path.exists():
            raise FileNotFoundError(f"JSON file not found: {file_path}")

        with open(file_path, encoding="utf-8") as f:
            return json.load(f)

    @classmethod
    def jsonify(cls, filename: str):
        """
        Load the file and return Flask `jsonify` response.
        """
        data = cls.load(filename)
        return jsonify(data)
