# app/managers/mongodb_management.py
from flask import current_app
import os
from typing import Optional

from pymongo import MongoClient, ReturnDocument

from .response_management import ResponseManager
from ..constants.constants_mongodb import MongoDBEntity


class MongoDBManager:
    """
    A simple MongoDB utility class to manage connections and CRUD operations.
    """

    _client = None
    MONGO_URI = None
    MONGO_SERVER_SELECTION_TIMEOUT_MS = None
    MONGO_SOCKET_TIMEOUT_MS = None
    MONGO_MAX_POOL_SIZE = None

    # admins db
    MONGO_ADMINS_DB_NAME = None
    admin_login_collection_name = "login_passwords_hashed"

    # offices db
    MONGO_OFFICES_DB_NAME = None
    offices_collection_name = "offices_col"
    office_counter_name = "office_counter"

    # tenant office db
    counters_collection_name = "counters"
    user_counter_name = "user_counter"
    case_counter_name = "case_counter"
    client_counter_name = "client_counter"
    file_counter_name = "file_counter"
    task_counter_name = "task_counter"
    profile_counter_name = "profile_counter"

    users_collection_name = "users"
    cases_collection_name = "cases"
    clients_collection_name = "clients"
    files_collection_name = "files"
    tasks_collection_name = "tasks"
    profiles_collection_name = "profiles"

    # ------------------------ Connection -------------------------

    @classmethod
    def init(cls):
        """
        Initialize the MongoClient once when the application starts.
        """
        if cls._client is not None:
            return  # already initialized

        cls.MONGO_URI = os.getenv("MONGO_URI")
        cls.MONGO_SERVER_SELECTION_TIMEOUT_MS = int(
            os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000")
        )
        cls.MONGO_SOCKET_TIMEOUT_MS = int(os.getenv("MONGO_SOCKET_TIMEOUT_MS", "10000"))
        cls.MONGO_MAX_POOL_SIZE = int(os.getenv("MONGO_MAX_POOL_SIZE", "100"))

        cls._client = MongoClient(
            cls.MONGO_URI,
            serverSelectionTimeoutMS=cls.MONGO_SERVER_SELECTION_TIMEOUT_MS,
            socketTimeoutMS=cls.MONGO_SOCKET_TIMEOUT_MS,
            maxPoolSize=cls.MONGO_MAX_POOL_SIZE,
            retryWrites=True,
            retryReads=True,
        )

        cls.MONGO_ADMINS_DB_NAME = str(os.getenv("MONGO_ADMINS_DB_NAME", "admins_db"))
        cls.MONGO_OFFICES_DB_NAME = str(
            os.getenv("MONGO_OFFICES_DB_NAME", "offices_db")
        )

    @classmethod
    def _get_client(cls) -> MongoClient:
        """
        Lazy initialize and return the MongoClient instance.

        Args:
            None

        Returns:
            MongoClient: A pymongo MongoClient instance.
        """

        if cls._client is None:
            cls.init()

        return cls._client

    @classmethod
    def _get_db(cls, db_name: str) -> MongoClient:
        """
        Retrieve a specific MongoDB database by name.

        Args:
            db_name (str): Name of the database to access.

        Returns:
            Database: A pymongo Database object.
        """

        if not db_name:
            # debug bad request
            current_app.logger.debug(f"bad_request: 'db_name' is required")
            return ResponseManager.bad_request(error="db_name is required")

        client = cls._get_client()
        db = client[db_name]
        return db

    @classmethod
    def _get_collection(cls, db_name: str, collection_name: str):
        """
        Retrieve a specific collection from a given MongoDB database.

        Args:
            db_name (str): The name of the database.
            collection_name (str): The name of the collection to access.

        Returns:
            Collection: A pymongo Collection object.
        """

        if not db_name:
            # debug bad request
            current_app.logger.debug(f"bad_request: 'db_name' is required")
            return ResponseManager.bad_request(error="db_name is required")

        if not collection_name:
            # debug bad request
            current_app.logger.debug(f"bad_request: 'collection_name' is required")
            return ResponseManager.bad_request(error="collection_name is required")

        db = cls._get_db(db_name)
        collection = db[collection_name]
        return collection

    # ---------- CRUD (Create, Read, Update and Delete) Wrappers -----------

    # ---------- Reads -----------
    @classmethod
    def _get_records(
        cls,
        db_name: str,
        collection_name: str,
        filters: Optional[dict] = None,
        projection: Optional[dict] = None,
        sort: Optional[tuple[str, int]] = None,
        limit: int = 0,
    ):
        """
        Retrieve documents from a MongoDB collection with optional filters,
        projection, sorting, and limit.

        Args:
            db_name (str): Database name.
            collection_name (str): Collection name.
            filters (dict, optional): MongoDB query filter (default: {}).
            projection (dict, optional): Fields to include/exclude (e.g., {"_id": 0, "email": 1}).
            sort (tuple[str, int], optional): Sort key and direction (1=ASC, -1=DESC).
            limit (int, optional): Maximum number of results to return (0 = unlimited).

        Returns:
            ResponseManager: success with list of documents, or error response.

        """
        current_app.logger.debug(f"inside _get_records()")
        # debug inputs
        current_app.logger.debug(f"db_name: {db_name}")
        current_app.logger.debug(f"collection_name: {collection_name}")
        current_app.logger.debug(f"filters: {filters}")
        current_app.logger.debug(f"projection: {projection}")
        current_app.logger.debug(f"sort: {'ascending' if sort == 1 else 'descending'}")
        current_app.logger.debug(f"limit: {'unlimited' if limit == 0 else limit}")

        if not db_name:
            # debug bad request
            msg = f"'db_name' is required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)
        if not collection_name:
            # debug bad request
            msg = f"'collection_name' is required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        collection = cls._get_collection(db_name, collection_name)
        filters = filters or {}
        projection = projection or {"_id": 0}
        cursor = collection.find(filters, projection)

        if sort:
            key, direction = sort
            cursor = cursor.sort(key, direction)

        if limit > 0:
            cursor = cursor.limit(limit)

        results = list(cursor)
        # debug db_name@collection_name number of results
        current_app.logger.debug(
            f"[{db_name}@{collection_name}] Retrieved {len(results)} record(s)"
        )

        if len(results) == 0:
            # debug no content
            msg = f"no content from _get_records()"
            current_app.logger.debug(msg)
            return ResponseManager.no_content(message=msg)

        # debug success
        msg = f"success with results from _get_records()"
        current_app.logger.debug(msg)
        return ResponseManager.success(data=results, message=msg)

    # ---------- Updates -----------
    @classmethod
    def _update_fields(
        cls,
        db_name: str,
        collection_name: str,
        filters: dict,
        update_data: dict,
        *,
        multiple: bool,
        operator: str = "$set",
    ):
        """
        Update one or multiple documents using a specified MongoDB update operator.

        Args:
            db_name (str): Database name.
            collection_name (str): Collection name.
            filters (dict): Query filter to match target documents.
            update_data (dict): The data to apply under the given operator.
            multiple (bool):
                - True → update all matching documents.
                - False → update the first matching document.
            operator (str): MongoDB operator (default: "$set").
                Supported: "$set", "$inc", "$push", "$pull", "$addToSet", etc.

        Returns:
            int: Number of modified documents.
        """
        if not db_name:
            msg = f"'db_name' is required"
            # debug bad request
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        if not collection_name:
            # debug bad request
            msg = f"'collection_name' is required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        if not operator.startswith("$"):
            # debug bad request
            msg = f"Invalid MongoDB operator (must start with '$')"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        collection = cls._get_collection(db_name, collection_name)
        update_query = {operator: update_data}

        if multiple:
            result = collection.update_many(filters, update_query)
        else:
            result = collection.update_one(filters, update_query)

        modified = result.modified_count

        # debug db_name@collection_name number of deleted docs
        current_app.logger.debug(
            f"[{db_name}@{collection_name}] Updated {modified} document(s) "
            f"with operator='{operator}', multiple={multiple}"
        )

        if modified == 0:
            # debug no content
            msg = f"no content from _update_fields()"
            current_app.logger.debug(msg)
            return ResponseManager.no_content(message=msg)

        # debug success
        msg = f"success with modified count from _update_records()"
        current_app.logger.debug(msg)
        return ResponseManager.success(data=modified, message=msg)

    # ---------- Deletes -----------
    @classmethod
    def _delete_records(
        cls,
        db_name: str,
        collection_name: str,
        filters: Optional[dict] = None,
    ):
        """
        Delete documents from a MongoDB collection with optional filters.

        Args:
            db_name (str): Database name.
            collection_name (str): Collection name.
            filters (dict, optional): MongoDB query filter (default: {}).

        Returns:
            ResponseManager: success with deleted_count, or error response.
        """

        current_app.logger.debug(f"inside _delete_records()")
        # debug inputs
        current_app.logger.debug(f"db_name: {db_name}")
        current_app.logger.debug(f"collection_name: {collection_name}")
        current_app.logger.debug(f"filters: {filters}")

        if not db_name:
            msg = f"'db_name' is required"
            # debug bad request
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        if not collection_name:
            # debug bad request
            msg = f"'collection_name' is required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        collection = cls._get_collection(db_name, collection_name)
        filters = filters or {}

        result = collection.delete_many(filters)
        deleted_count = result.deleted_count

        # debug db_name@collection_name number of deleted docs
        current_app.logger.debug(
            f"[{db_name}@{collection_name}] Deleted {deleted_count} record(s)"
        )

        if deleted_count == 0:
            # debug no content
            msg = f"no content from _delete_records()"
            current_app.logger.debug(msg)
            return ResponseManager.no_content(message=msg)

        # debug success
        msg = f"success with deleted count from _delete_records()"
        current_app.logger.debug(msg)
        return ResponseManager.success(data=deleted_count, message=msg)

    # ---------------------- Index Management ----------------------

    @classmethod
    def ensure_indexes(cls, db_name: str):
        """
        Ensure all required indexes exist for a given tenant (office) database.

        This method is idempotent — running it multiple times will not duplicate indexes.

        Args:
            db_name (str): Target database name (e.g., office_serial).

        Returns:
            list[str]: Names of all indexes created or verified.
        """
        if not db_name:
            msg = f"'db_name' is required"
            # debug bad request
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        created_indexes = []
        collections_names = [
            cls.users_collection_name,
            cls.cases_collection_name,
            cls.clients_collection_name,
            cls.files_collection_name,
            cls.tasks_collection_name,
            cls.profiles_collection_name,
        ]

        for collection_name in collections_names:
            collection = cls._get_collection(db_name, collection_name)

            collection.create_index("serial", unique=True)

            if collection_name == "users":
                collection.create_index("username", unique=True)

            if collection_name == cls.profiles_collection_name:
                collection.create_index("name", unique=True)

            for idx in collection.list_indexes():
                created_indexes.append(f"{collection_name}.{idx['name']}")

        if len(created_indexes) == 0:
            # debug no content
            msg = f"no content from ensure_indexes()"
            current_app.logger.debug(msg)
            return ResponseManager.no_content(message=msg)

        # debug success
        msg = f"success with ensured indexes in db='{db_name}' from ensured_indexes()"
        current_app.logger.debug(msg)
        return ResponseManager.success(data=created_indexes, message=msg)

    # ------------------------ Entity Helpers -------------------------

    @classmethod
    def get_entity(
        cls,
        entity: str,
        office_serial: int = None,
        filters: dict = None,
        projection: dict = None,
        sort: tuple[str, int] = None,
        limit: int = 0,
        expand: bool = False,
    ):

        current_app.logger.debug(f"inside get_entity()")
        # debug inputs
        current_app.logger.debug(f"entity: {entity}")
        current_app.logger.debug(f"filters: {filters}")
        current_app.logger.debug(f"projection: {projection}")
        current_app.logger.debug(f"sort: {sort}")
        current_app.logger.debug(f"limit: {limit}")

        if not entity:
            # debug bad request
            msg = f"'entity' is required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        results = []
        db_names = (
            [str(office_serial)] if office_serial else list(cls._iter_tenant_dbs())
        )

        # debug db names
        msg = f"db_names: {db_names}"
        current_app.logger.debug(msg)

        for db_name in db_names:

            # debug func call
            current_app.logger.debug(f"calling get_records() from get_entity()")
            records_res = cls._get_records(
                db_name=db_name,
                collection_name=entity,
                filters=filters,
                projection=projection,
                sort=sort,
                limit=limit,
            )

            if not ResponseManager.is_success(response=records_res):
                # debug error from get records
                error_res = ResponseManager.get_error(response=records_res)
                msg_res = ResponseManager.get_message(response=records_res)
                msg = f"skipping DB '{db_name}', result details: [error - {error_res}, message - {msg_res}]"
                current_app.logger.debug(msg)
                continue

            if ResponseManager.is_no_content(records_res):
                # debug no content from get records
                msg_res = ResponseManager.get_message(response=records_res)
                msg = f"skipping DB '{db_name}', result details: [message - {msg_res}]"
                current_app.logger.debug(msg)
                continue

            entity_docs = ResponseManager.get_data(response=records_res)
            for doc in entity_docs:
                doc["office_serial"] = int(db_name)
                # enriched = {f"{entity}": doc, "office_serial": int(db_name)}

                if expand:
                    # debug expansion
                    current_app.logger.debug(f"expand: {expand}")
                    if entity == cls.cases_collection_name:
                        # debug case expanding
                        current_app.logger.debug(f"expanding case entity")
                        cls._expand_case_user(doc, db_name)
                        cls._expand_case_responsible(doc, db_name)
                        cls._expand_case_clients(doc, db_name)
                        cls._expand_case_files(doc, db_name)
                        cls._expand_case_tasks(doc, db_name)

                results.append(doc)

        if not results:
            # debug no content
            msg = f"no content from get_entity()"
            current_app.logger.debug(msg)
            return ResponseManager.no_content(message=msg)

        # debug success
        msg = f"success with results[] from get_entity()"
        current_app.logger.debug(msg)
        return ResponseManager.success(data=results, message=msg)

    @classmethod
    def _expand_case_user(cls, case_doc, office_serial):
        current_app.logger.debug(f"inside _expand_case_user()")

        user_serial = case_doc.pop("user_serial", None)
        if not user_serial:
            # debug bad request
            msg = f"Missing 'user_serial' in case document"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        case_doc["user"] = {}

        # debug func call
        current_app.logger.debug(f"calling get_entity() from get_entity()")
        user_res = cls.get_entity(
            entity=MongoDBEntity.USERS,
            office_serial=office_serial,
            filters={"serial": user_serial},
            limit=1,
            expand=False,
        )

        if not ResponseManager.is_success(response=user_res):
            # debug error
            error_res = ResponseManager.get_error(response=user_res)
            msg_res = ResponseManager.get_message(response=user_res)
            msg = f"failed to expand user_serial= {user_serial}, result details: [error - {error_res}, message - {msg_res}]"
            current_app.logger.debug(msg)
            return user_res

        if ResponseManager.is_no_content(response=user_res):
            return user_res

        # debug success
        users = ResponseManager.get_data(response=user_res)
        user = users[0]
        case_doc["user"] = user

        msg = f"returning from _expand_case_user()"
        current_app.logger.debug(msg)

    @classmethod
    def _expand_case_responsible(cls, case_doc, office_serial):
        current_app.logger.debug(f"inside _expand_case_responsible()")

        responsible_serial = case_doc.pop("responsible_serial", None)
        if not responsible_serial:
            # debug bad request
            msg = f"Missing 'responsible_serial' in case document"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        case_doc["responsible"] = {}

        # debug func call
        current_app.logger.debug(f"calling get_entity() from get_entity()")
        user_res = cls.get_entity(
            entity=MongoDBEntity.USERS,
            office_serial=office_serial,
            filters={"serial": responsible_serial},
            limit=1,
            expand=False,
        )

        if not ResponseManager.is_success(response=user_res):
            # debug error
            error_res = ResponseManager.get_error(response=user_res)
            msg_res = ResponseManager.get_message(response=user_res)
            msg = f"failed to expand responsible_serial= {responsible_serial}, result details: [error - {error_res}, message - {msg_res}]"
            current_app.logger.debug(msg)
            return user_res

        if ResponseManager.is_no_content(response=user_res):
            return user_res

        # debug success
        users = ResponseManager.get_data(response=user_res)
        user = users[0]
        case_doc["responsible"] = user

        msg = f"returning from _expand_case_responsible()"
        current_app.logger.debug(msg)

    @classmethod
    def _expand_case_clients(cls, case_doc, office_serial):
        current_app.logger.debug(f"inside _expand_case_clients()")

        case_doc["clients"] = []

        clients_serials_with_roles = case_doc.pop("clients_serials_with_roles", None)
        if not clients_serials_with_roles:
            # debug bad request
            msg = f"Missing 'clients_serials_with_roles' in case document"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        msg = f"found clients_serials_with_roles: {clients_serials_with_roles}"
        current_app.logger.debug(msg)

        for client_serial_str, role, legal_role in clients_serials_with_roles:
            client_serial = int(client_serial_str)

            # debug func call
            msg = f"calling get_entity() from _expand_case_clients() for client_serial={client_serial}"
            current_app.logger.debug(msg)

            clients_res = cls.get_entity(
                entity=MongoDBEntity.CLIENTS,
                office_serial=office_serial,
                filters={"serial": client_serial},
                limit=1,
                expand=False,
            )

            if not ResponseManager.is_success(response=clients_res):
                # debug error
                error_res = ResponseManager.get_error(response=clients_res)
                msg_res = ResponseManager.get_message(response=clients_res)
                msg = f"failed to expand client_serial= {client_serial}, result details: [error - {error_res}, message - {msg_res}]"
                current_app.logger.debug(msg)
                continue

            clients = ResponseManager.get_data(response=clients_res)
            if not clients:
                # debug no content
                msg = f"no content from _expand_case_clients() on client_serial={client_serial}"
                current_app.logger.debug(msg)
                continue

            # debug success
            client = clients[0]
            client["role"] = role
            client["legal_role"] = legal_role
            case_doc["clients"].append(client)

            msg = f"successfully expanded client_serial={client_serial} with role={role}, and legal_role={legal_role}"
            current_app.logger.debug(msg)

        # debug success
        msg = f"returning from _expand_case_clients()"
        current_app.logger.debug(msg)

    @classmethod
    def _expand_case_files(cls, case_doc, office_serial):
        current_app.logger.debug(f"inside _expand_case_files()")

        case_doc["files"] = []

        files_serials = case_doc.pop("files_serials", None)
        if not files_serials:
            # debug bad request
            msg = f"Missing 'files_serials' in case document"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        for file_serial_str in files_serials:
            file_serial = int(file_serial_str)

            # debug func call
            msg = f"calling get_entity() from _expand_case_files() for file_serial={file_serial}"
            current_app.logger.debug(msg)

            files_res = cls.get_entity(
                entity=MongoDBEntity.FILES,
                office_serial=office_serial,
                filters={"serial": file_serial},
                limit=1,
                expand=False,
            )

            if not ResponseManager.is_success(response=files_res):
                # debug error
                error_res = ResponseManager.get_error(response=files_res)
                msg_res = ResponseManager.get_message(response=files_res)
                msg = f"failed to expand file_serial= {file_serial}, result details: [error - {error_res}, message - {msg_res}]"
                current_app.logger.debug(msg)
                continue

            files = ResponseManager.get_data(response=files_res)
            if not files:
                # debug no content
                msg = (
                    f"no content from _expand_case_files() on file_serial={file_serial}"
                )
                current_app.logger.debug(msg)
                continue

            # debug success
            file = files[0]
            case_doc["files"].append(file)

            msg = f"successfully expanded file_serial={file_serial}"
            current_app.logger.debug(msg)

        current_app.logger.debug(f"returning from _expand_case_files()")

    @classmethod
    def _expand_case_tasks(cls, case_doc, office_serial):
        current_app.logger.debug(f"inside _expand_case_tasks()")

        case_doc["tasks"] = []

        tasks_serials = case_doc.pop("tasks_serials", None)
        if not tasks_serials:
            # debug bad request
            msg = f"Missing 'tasks_serials' in case document"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        for task_serial in tasks_serials:
            msg = f"calling get_entity() from _expand_case_tasks() for task_serial={task_serial}"
            current_app.logger.debug(msg)

            tasks_res = cls.get_entity(
                entity=MongoDBEntity.TASKS,
                office_serial=office_serial,
                filters={"serial": task_serial},
                limit=1,
                expand=False,
            )

            if not ResponseManager.is_success(response=tasks_res):
                # debug error
                error_res = ResponseManager.get_error(response=tasks_res)
                msg_res = ResponseManager.get_message(response=tasks_res)
                msg = f"failed to expand task_serial= {task_serial}, result details: [error - {error_res}, message - {msg_res}]"
                current_app.logger.debug(msg)
                continue

            tasks = ResponseManager.get_data(response=tasks_res)
            if not tasks:
                # debug no content
                msg = (
                    f"no content from _expand_case_tasks() on task_serial={task_serial}"
                )
                current_app.logger.debug(msg)
                continue

            # debug success
            task = tasks[0]
            case_doc["tasks"].append(task)

            msg = f"successfully expanded task_serial={task_serial}"
            current_app.logger.debug(msg)

        current_app.logger.debug("returning from _expand_case_tasks()")

    @classmethod
    def create_entity(cls, entity: str, office_serial: int, document: dict):
        """
        Generic create for all entities (users/clients/cases/files)
        Automatically assign serial from the correct counter.

        Args:
            entity (str): Entity type (users, clients, cases, files).
            office_serial (int): Tenant office serial number.
            document (dict): Document data to insert.

        Returns:
            ResponseManager: success with new serial, or error response.
        """

        current_app.logger.debug(f"inside create_entity()")
        # debug inputs
        current_app.logger.debug(f"entity: {entity}")
        current_app.logger.debug(f"office_serial: {office_serial}")
        current_app.logger.debug(f"document: {document}")

        if not entity:
            # debug bad request
            msg = f"'entity' is required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        if not office_serial:
            # debug bad request
            msg = f"'office_serial' is required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        if not document or not isinstance(document, dict):
            # debug bad request
            msg = f"returning bad_request: missing or invalid 'document'"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        db_name = str(office_serial)

        # Assign serial by entity type
        counter_res = MongoDBManager.get_entity_counter(entity=entity, db_name=db_name)
        if not ResponseManager.is_success(response=counter_res):
            # debug error
            error_res = ResponseManager.get_error(response=counter_res)
            msg_res = ResponseManager.get_message(response=counter_res)
            msg = f"failed to get counter, result details: [error - {error_res}, message - {msg_res}]"
            current_app.logger.debug(msg)
            return counter_res

        # attach serial number to entity document
        serial = ResponseManager.get_data(response=counter_res)
        document["serial"] = serial

        # insert into DB
        collection = cls._get_collection(db_name, entity)
        result = collection.insert_one(document)

        # debug success
        msg = f"created new {entity} with serial={serial} in DB {db_name}"
        current_app.logger.debug(msg)
        return ResponseManager.created(data=serial, message=msg)

    @classmethod
    def delete_entity(
        cls, entity: str, office_serial: int = None, filters: dict = None
    ):
        """
        Delete entities from a given collection (and optionally tenant DB).
        Returns a ResponseManager response object.

        Args:
            entity (str): Entity type (users, clients, cases, files).
            office_serial (int, optional): Tenant office serial number.
                If None, deletes across all tenant DBs.
            filters (dict): MongoDB query filter to match documents to delete.

        Returns:
            ResponseManager: success with deletion details, or error response.
        """

        current_app.logger.debug("inside delete_entity()")
        # debug inputs
        current_app.logger.debug(f"entity: {entity}")
        current_app.logger.debug(f"office_serial: {office_serial}")
        current_app.logger.debug(f"filters: {filters}")

        if not entity:
            # debug bad request
            msg = f"'entity' is required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        if not office_serial:
            # debug bad request
            msg = f"'office_serial' is required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        if not filters:
            # debug bad request
            msg = f"'filters' are required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        results = []
        db_names = (
            [str(office_serial)] if office_serial else list(cls._iter_tenant_dbs())
        )
        current_app.logger.debug(f"db_names: {db_names}")

        total_deleted = 0

        for db_name in db_names:

            # debug func call
            msg = f"calling delete_records() for DB '{db_name}'"
            current_app.logger.debug(msg)

            delete_res = cls._delete_records(
                db_name=db_name, collection_name=entity, filters=filters
            )

            if not ResponseManager.is_success(response=delete_res):
                # debug error from delete records
                error_res = ResponseManager.get_error(response=delete_res)
                msg_res = ResponseManager.get_message(response=delete_res)
                msg = f"skipping DB '{db_name}', result details: [error - {error_res}, message - {msg_res}]"
                current_app.logger.debug(msg)
                continue

            deleted_count = ResponseManager.get_data(response=delete_res)
            total_deleted += deleted_count

            results.append(
                {"office_serial": int(db_name), "deleted_count": deleted_count}
            )

        if total_deleted == 0:
            # debug no content
            msg = f"no content from delete_entity()"
            current_app.logger.debug(msg)
            return ResponseManager.no_content(message=msg)

        # debug success
        msg = f"success with results from delete_entity()"
        current_app.logger.debug(msg)
        return ResponseManager.success(data=results, message=msg)

    @classmethod
    def update_entity(
        cls,
        entity: str,
        office_serial: int = None,
        filters: dict = None,
        update_data: dict = None,
        *,
        multiple: bool = False,
        operator: str = "$set",
    ):
        """
        Public interface to update entities (users, clients, files, cases)
        inside a specific tenant DB or across all tenants.

        Wraps _update_fields() and always returns a ResponseManager object.

        Args:
            entity (str): Entity type (users, clients, cases, files).
            office_serial (int, optional): Tenant office serial number.
                If None, updates across all tenant DBs.
            filters (dict): MongoDB query filter to match documents to update.
            update_data (dict): The data to apply under the given operator.
            multiple (bool):
                - True → update all matching documents.
                - False → update the first matching document.
            operator (str): MongoDB operator (default: "$set").
                Supported: "$set", "$inc", "$push", "$pull", "$addToSet", etc.

        Returns:
            ResponseManager: success with update details, or error response.
        """

        current_app.logger.debug("inside update_entity()")
        # debug inputs
        current_app.logger.debug(f"entity={entity}")
        current_app.logger.debug(f"office_serial={office_serial}")
        current_app.logger.debug(f"filters={filters}")
        current_app.logger.debug(f"update_data={update_data}")
        current_app.logger.debug(f"multiple={multiple}")
        current_app.logger.debug(f"operator={operator}")

        if not entity:
            # debug bad request
            msg = f"'entity' is required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        if not filters:
            # debug bad request
            msg = f"'filters' are required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        if not update_data:
            # debug bad request
            msg = f"'update_data' are required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        db_names = (
            [str(office_serial)] if office_serial else list(cls._iter_tenant_dbs())
        )
        total_modified = 0
        results = []

        for db_name in db_names:

            # debug func call
            msg = f"calling _update_fields() for DB '{db_name}'"
            current_app.logger.debug(msg)

            update_res = cls._update_fields(
                db_name=db_name,
                collection_name=entity,
                filters=filters,
                update_data=update_data,
                multiple=multiple,
                operator=operator,
            )

            if not ResponseManager.is_success(response=update_res):
                # debug error from delete records
                error_res = ResponseManager.get_error(response=update_res)
                msg_res = ResponseManager.get_message(response=update_res)
                msg = f"skipping DB '{db_name}', result details: [error - {error_res}, message - {msg_res}]"
                current_app.logger.debug(msg)
                continue

            modified_count = ResponseManager.get_data(response=update_res)
            total_modified += modified_count

            results.append(
                {"office_serial": int(db_name), "modified_count": modified_count}
            )

        if total_modified == 0:
            # debug no content
            msg = f"no content from update_entity()"
            current_app.logger.debug(msg)
            return ResponseManager.no_content(message=msg)

        # debug success
        msg = f"success with results from update_entity()"
        current_app.logger.debug(msg)
        return ResponseManager.success(data=results, message=msg)

    # ------------------------ Counters -------------------------

    @classmethod
    def _get_next_counter(cls, db_name: str, counter_name: str) -> tuple:
        """
        Atomically increments and returns the next sequence value for a counter.

        Commonly used for generating unique serials (e.g., user IDs, case IDs).

        Args:
            db_name (str): The tenant (office) database name.
            counter_name (str): The counter key (e.g., "user_counter").

        Returns:
            ResponseManager: success with new counter value, or error response.
        """

        current_app.logger.debug(f"inside _get_next_counter()")
        # debug inputs
        current_app.logger.debug(f"db_name: {db_name}")
        current_app.logger.debug(f"counter_name: {counter_name}")

        if not db_name:
            # debug bad request
            msg = f"'db_name' is required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        if not counter_name:
            # debug bad request
            msg = f"'counter_name' are required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        collection = cls._get_collection(db_name, cls.counters_collection_name)

        result = collection.find_one_and_update(
            {"_id": counter_name},
            {"$inc": {"value": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

        if not result or "value" not in result:
            # debug error
            msg = f"counter '{counter_name}' could not be incremented"
            current_app.logger.debug(msg)
            return ResponseManager.internal(message=msg)

        new_value = int(result["value"])

        # debug success
        msg = f"success with new value from _get_next_counter()"
        current_app.logger.info(msg)
        return ResponseManager.success(data=new_value, message=msg)

    # ---------- Tenant ----------

    @classmethod
    def get_entity_counter(cls, entity: str, db_name: str) -> tuple:
        """Increment and return the user counter for the given tenant DB."""
        match entity:
            case cls.users_collection_name:
                return cls.get_user_counter(db_name)
            case cls.clients_collection_name:
                return cls.get_client_counter(db_name)
            case cls.cases_collection_name:
                return cls.get_case_counter(db_name)
            case cls.files_collection_name:
                return cls.get_file_counter(db_name)
            case cls.tasks_collection_name:
                return cls.get_task_counter(db_name)
            case cls.profiles_collection_name:
                return cls.get_profile_counter(db_name)
            case _:
                msg = f"Unknown entity: {entity}"
                return ResponseManager.bad_request(message=msg)

    @classmethod
    def get_user_counter(cls, db_name: str) -> tuple:
        """Increment and return the user counter for the given tenant DB."""
        return cls._get_next_counter(db_name, cls.user_counter_name)

    @classmethod
    def get_case_counter(cls, db_name: str) -> tuple:
        """Increment and return the case counter for the given tenant DB."""
        return cls._get_next_counter(db_name, cls.case_counter_name)

    @classmethod
    def get_client_counter(cls, db_name: str) -> tuple:
        """Increment and return the client counter for the given tenant DB."""
        return cls._get_next_counter(db_name, cls.client_counter_name)

    @classmethod
    def get_file_counter(cls, db_name: str) -> tuple:
        """Increment and return the file counter for the given tenant DB."""
        return cls._get_next_counter(db_name, cls.file_counter_name)

    @classmethod
    def get_task_counter(cls, db_name: str) -> tuple:
        """Increment and return the file counter for the given tenant DB."""
        return cls._get_next_counter(db_name, cls.task_counter_name)

    @classmethod
    def get_profile_counter(cls, db_name: str) -> tuple:
        """Increment and return the profile counter for the given tenant DB."""
        return cls._get_next_counter(db_name, cls.profile_counter_name)

    @classmethod
    def get_offices_counter(cls) -> tuple:
        """Increment and return the global office counter."""
        return cls._get_next_counter(cls.MONGO_OFFICES_DB_NAME, cls.office_counter_name)

    # ---------------------- Helpers ----------------------

    # ---------- Tenant ----------
    @classmethod
    def _create_office_database(cls, office_serial: str):
        """
        Initialize a new office (tenant) database with required indexes and counters.

        Args:
            office_serial (str): The unique serial (identifier) of the office.

        Returns:
            ResponseManager: success with db_name, or error response.

        """

        current_app.logger.debug(f"inside _create_office_database()")
        # debug inputs
        current_app.logger.debug(f"office_serial: {office_serial}")

        if not office_serial:
            # debug bad request
            msg = f"'office_serial' is required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        client = cls._get_client()
        db_name = str(office_serial)

        if db_name in client.list_database_names():
            # debug conflict
            msg = f"DB '{db_name}' already exists"
            current_app.logger.debug(msg)
            return ResponseManager.conflict(message=msg)

        # debug func call
        msg = f"calling ensure_indexes() from _create_office_database()"
        current_app.logger.debug(msg)
        cls.ensure_indexes(db_name)

        # Initialize counter collection
        counters = cls._get_collection(db_name, cls.counters_collection_name)
        counter_names = [
            cls.user_counter_name,
            cls.case_counter_name,
            cls.client_counter_name,
            cls.file_counter_name,
            cls.task_counter_name,
            cls.profile_counter_name,
        ]

        for name in counter_names:
            counters.update_one(
                {"_id": name}, {"$setOnInsert": {"value": 0}}, upsert=True
            )

        # debug success
        msg = f"created new office= {db_name} and initialized successfully"
        current_app.logger.debug(msg)
        return ResponseManager.created(message=msg)

    @classmethod
    def _iter_tenant_dbs(cls):
        excluded = {
            "admin",
            "local",
            "config",
            cls.MONGO_ADMINS_DB_NAME,
            cls.MONGO_OFFICES_DB_NAME,
        }
        for name in cls._get_client().list_database_names():
            if name not in excluded:
                yield str(name)

    @classmethod
    def get_office_serial(cls, office_name: str):
        """
        Retrieve the unique office_serial associated with a given office_name
        from the global 'offices_db.offices_col' collection.

        Args:
            office_name (str): The office name to search for.

        Returns:
            str | None: The office_serial if found, otherwise None.
        """
        current_app.logger.debug(f"inside get_office_serial()")
        # debug inputs
        current_app.logger.debug(f"office_name: {office_name}")

        if not office_name:
            # debug bad request
            msg = f"'office_name' is required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        db_name = cls.MONGO_OFFICES_DB_NAME
        collection_name = cls.offices_collection_name

        collection = cls._get_collection(db_name, collection_name)
        doc = collection.find_one({"name": office_name}, {"_id": 0, "serial": 1})

        if doc and "serial" in doc:
            office_serial = doc["serial"]
            # debug success
            msg = f"success with office_serial= '{office_serial}' from get_office_serial()"
            current_app.logger.debug(msg)
            return ResponseManager.success(data=office_serial, message=msg)

        # debug not found
        msg = f"not found with office_name='{office_name}' from get_office_serial()"
        current_app.logger.debug(msg)
        return ResponseManager.not_found(message=msg)

    @classmethod
    def get_office_name(cls, office_serial: int):
        """
        Retrieve the unique office_serial associated with a given office_name
        from the global 'offices_db.offices_col' collection.

        Args:
            office_serial (str): The office serial to search for.

        Returns:
            str | None: The office_serial if found, otherwise None.
        """
        current_app.logger.debug(f"inside get_office_name()")
        # debug inputs
        current_app.logger.debug(f"office_serial: {office_serial}")

        if not office_serial:
            # debug bad request
            msg = f"'office_serial' is required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        db_name = cls.MONGO_OFFICES_DB_NAME
        collection_name = cls.offices_collection_name

        collection = cls._get_collection(db_name, collection_name)
        doc = collection.find_one({"serial": office_serial}, {"_id": 0, "name": 1})

        if doc and "name" in doc:
            office_name = doc["name"]
            # debug success
            msg = f"success with office_name= '{office_name}' from get_office_name()"
            current_app.logger.debug(msg)
            return ResponseManager.success(data=office_name, message=msg)

        # debug not found
        msg = f"not found with office_serial='{office_serial}' from get_office_name()"
        current_app.logger.debug(msg)
        return ResponseManager.not_found(message=msg)

    @classmethod
    def get_offices(cls):
        """
        Return all offices from the global offices registry.
        NOTE: returns success([]) when there are no offices yet.
        """
        current_app.logger.debug("inside get_offices()")

        offices_res = cls._get_records(
            db_name=cls.MONGO_OFFICES_DB_NAME,
            collection_name=cls.offices_collection_name,
            filters={},
            projection={"_id": 0},
            sort=("serial", 1),
            limit=0,
        )

        if not ResponseManager.is_success(response=offices_res):
            # debug error
            error_res = ResponseManager.get_error(response=offices_res)
            msg_res = ResponseManager.get_message(response=offices_res)
            msg = f"failed to get offices, result details: [error - {error_res}, message - {msg_res}]"
            current_app.logger.debug(msg)
            return offices_res

        # debug success
        msg = f"success with offices"
        return offices_res

    @classmethod
    def create_new_office(cls, office_name: str = ""):
        """
        Always creates a new office:
        - gets new office_serial from global counter
        - inserts into offices_db.offices_col
        - initializes tenant DB with counters=0 and indexes
        """
        current_app.logger.debug("inside create_new_office()")
        current_app.logger.debug(f"office_name: {office_name}")

        if not office_name:
            # debug bad request
            msg = f"'office_name' is required"
            current_app.logger.debug(msg)
            return ResponseManager.bad_request(message=msg)

        db_name = cls.MONGO_OFFICES_DB_NAME
        collection_name = cls.offices_collection_name
        collection = cls._get_collection(db_name, collection_name)

        # allocate new serial
        counter_res = cls.get_offices_counter()
        if not ResponseManager.is_success(response=counter_res):
            # debug error
            error_res = ResponseManager.get_error(response=counter_res)
            msg_res = ResponseManager.get_message(response=counter_res)
            msg = f"failed to get counter, result details: [error - {error_res}, message - {msg_res}]"
            current_app.logger.debug(msg)
            return counter_res

        serial_str = ResponseManager.get_data(response=counter_res)
        serial = int(serial_str)

        collection.insert_one({"name": office_name, "serial": serial})

        # create tenant DB + counters=0
        create_res = cls._create_office_database(serial)
        if not ResponseManager.is_success(response=create_res):
            # rollback registry insert
            collection.delete_one({"serial": serial})
            return create_res

        # debug success
        msg = f"success with office serial"
        return ResponseManager.success(data=serial, message=msg)

    # ---------------------- Login ----------------------

    # ---------- Admin ----------
    @classmethod
    def get_admin_passwords_hashes(cls):
        current_app.logger.debug(f"inside get_admin_passwords_hashes()")

        db_name = cls.MONGO_ADMINS_DB_NAME
        collection_name = cls.admin_login_collection_name

        # debug func call
        current_app.logger.info(
            f"calling _get_records() from get_admin_passwords_hashes()"
        )
        admin_passwords_hashes_res = cls._get_records(
            db_name=db_name,
            collection_name=collection_name,
            projection={"_id": 0, "password_hash": 1},
        )
        if not ResponseManager.is_success(response=admin_passwords_hashes_res):
            # debug error
            current_app.logger.debug(
                f"returning internal error: Failed to get admin passwords hashes"
            )
            return ResponseManager.internal(
                error="Failed to get admin passwords hashes"
            )

        passwords_hashes = ResponseManager.get_data(response=admin_passwords_hashes_res)

        if not passwords_hashes:
            # debug not found
            current_app.logger.debug(
                f"returning not found: [DB@Col] [{db_name}@{collection_name}] "
                f"No admin passwords hashes found"
            )
            return ResponseManager.not_found(error="No admin passwords hashes found")

        # debug success
        current_app.logger.debug(
            f"returning success with {len(admin_passwords_hashes_res)} admin_passwords_hashes"
        )
        return ResponseManager.success(data=passwords_hashes)
