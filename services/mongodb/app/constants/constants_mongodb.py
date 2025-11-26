# backend/app/constants/constants_mongodb.py


class MongoDBEntity:
    USERS = "users"
    CLIENTS = "clients"
    FILES = "files"
    CASES = "cases"
    TASKS = "tasks"
    PROFILES = "profiles"

    @classmethod
    def all(cls):
        return {cls.USERS, cls.CLIENTS, cls.FILES, cls.CASES, cls.TASKS, cls.PROFILES}


class MongoDBFilters:
    @staticmethod
    def by_serial(serial: int):
        serial = int(serial)
        return {"serial": serial}

    class Case:
        active = {"status": "active"}
        archived = {"status": "archived"}

    class User:
        active = {"status": "active"}
        frozen = {"status": "frozen"}

        @staticmethod
        def by_username(username: str):
            return {"username": username}

    class File:
        evidence = {"type": "evidence"}
        invoice = {"type": "invoice"}


class MongoDBSort:
    newest = ("serial", -1)
    oldest = ("serial", 1)
