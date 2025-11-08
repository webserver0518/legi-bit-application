# backend/app/constants/constants_mongodb.py


class MongoDBEntity:
    USERS = "users"
    CLIENTS = "clients"
    FILES = "files"
    CASES = "cases"

    @classmethod
    def all(cls):
        return {
            cls.USERS,
            cls.CLIENTS,
            cls.FILES,
            cls.CASES
        }


class MongoDBFilters:
    @staticmethod
    def by_serial(serial: int):
        return {"serial": serial}

    class Case:
        open = {"status": "open"}
        closed = {"status": "closed"}
        active = {"status": {"$ne": "archived"}}
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


class MongoDBData:
    class Case:

        @staticmethod
        def status(value: str) -> dict:
            valid_statuses = {"open", "closed", "archived"}
            return {"status": value} if value in valid_statuses else None