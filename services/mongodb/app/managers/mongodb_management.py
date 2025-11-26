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

    users_collection_name = "users"
    cases_collection_name = "cases"
    clients_collection_name = "clients"
    files_collection_name = "files"
    tasks_collection_name = "tasks"

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
            cls.init_client()

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
            current_app.logger.debug(f"returning bad_request: 'db_name' is required")
            return ResponseManager.bad_request(error="'db_name' is required")
        if not collection_name:
            # debug bad request
            current_app.logger.debug(
                f"returning bad_request: 'collection_name' is required"
            )
            return ResponseManager.bad_request(error="'collection_name' is required")

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
            # debug not found
            current_app.logger.debug(f"returning not found")
            return ResponseManager.not_found(error="Not Found")

        # debug success
        current_app.logger.debug(f"returning success with results")
        return ResponseManager.success(data=results)

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
            # debug bad request
            current_app.logger.debug(f"returning bad_request: 'db_name' is required")
            return ResponseManager.bad_request(error="db_name is required")

        if not collection_name:
            # debug bad request
            current_app.logger.debug(
                f"returning bad_request: 'collection_name' is required"
            )
            return ResponseManager.bad_request(error="collection_name is required")

        if not operator.startswith("$"):
            # debug bad request
            current_app.logger.debug(
                f"returning bad_request: Invalid MongoDB operator (must start with '$')"
            )
            return ResponseManager.bad_request(
                error="Invalid MongoDB operator (must start with '$')"
            )

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
            # debug not found
            current_app.logger.debug(f"returning not found")
            return ResponseManager.not_found(error="Not Found")

        # debug success
        current_app.logger.debug(f"returning success with modified count")
        return ResponseManager.success(data=modified)

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
            # debug bad request
            current_app.logger.debug(f"returning bad_request: 'db_name' is required")
            return ResponseManager.bad_request(error="'db_name' is required")

        if not collection_name:
            # debug bad request
            current_app.logger.debug(
                f"returning bad_request: 'collection_name' is required"
            )
            return ResponseManager.bad_request(error="'collection_name' is required")

        collection = cls._get_collection(db_name, collection_name)
        filters = filters or {}

        result = collection.delete_many(filters)
        deleted_count = result.deleted_count

        # debug db_name@collection_name number of deleted docs
        current_app.logger.debug(
            f"[{db_name}@{collection_name}] Deleted {deleted_count} record(s)"
        )

        if deleted_count == 0:
            # debug not found
            current_app.logger.debug(
                f"returning not found (no documents matched filters)"
            )
            return ResponseManager.not_found(error="No documents matched filters")

        # debug success
        current_app.logger.debug(f"returning success with deleted count")
        return ResponseManager.success(data=deleted_count)

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
            # debug bad request
            current_app.logger.debug(f"returning bad_request: 'db_name' is required")
            return ResponseManager.bad_request(error="'db_name' is required")

        created_indexes = []
        collections_names = [
            cls.users_collection_name,
            cls.cases_collection_name,
            cls.clients_collection_name,
            cls.files_collection_name,
            cls.tasks_collection_name,
        ]

        for collection_name in collections_names:
            collection = cls._get_collection(db_name, collection_name)

            collection.create_index("serial", unique=True)

            if collection_name == "users":
                collection.create_index("username", unique=True)

            for idx in collection.list_indexes():
                created_indexes.append(f"{collection_name}.{idx['name']}")

        if len(created_indexes) == 0:
            # debug not found
            current_app.logger.debug(f"returning not found (no indexes created)")
            return ResponseManager.not_found(error="no indexes created")

        # debug success
        current_app.logger.debug(f"[{db_name}] Indexes ensured successfully")
        return ResponseManager.success(data=created_indexes)

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
            current_app.logger.debug(f"returning bad_request: 'entity' is required")
            return ResponseManager.bad_request(error="Missing 'entity'")

        results = []
        db_names = (
            [str(office_serial)] if office_serial else list(cls._iter_tenant_dbs())
        )

        # debug db names
        current_app.logger.debug(f"db_names: {db_names}")

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
                current_app.logger.debug(
                    f"skipping DB '{db_name}' due to response error  "
                    f"{ResponseManager.get_error(response=records_res)}"
                )
                continue

            entity_docs = ResponseManager.get_data(response=records_res)
            for doc in entity_docs:
                enriched = {f"{entity}": doc, "office_serial": int(db_name)}

                # debug expansion
                current_app.logger.debug(f"expand: {expand}")
                if entity == cls.cases_collection_name and expand:
                    # debug func call
                    current_app.logger.debug(f"calling expansion functions")
                    cls._expand_case_user(doc, db_name)
                    cls._expand_case_responsible(doc, db_name)
                    cls._expand_case_clients(doc, db_name)
                    cls._expand_case_files(doc, db_name)
                    cls._expand_case_tasks(doc, db_name)

                results.append(enriched)

        if not results:
            # debug not found
            current_app.logger.debug(
                f"entity {entity} with filters {filters} not found."
            )
            current_app.logger.debug(f"returning not found")
            return ResponseManager.not_found(error=f"Not Found")

        # debug success
        current_app.logger.debug(f"returning success with results")
        return ResponseManager.success(data=results)

    @classmethod
    def _expand_case_user(cls, case_doc, office_serial):
        current_app.logger.debug(f"inside _expand_case_user()")

        user_serial = case_doc.pop("user_serial", None)
        if not user_serial:
            # debug bad request
            current_app.logger.debug(f"Missing 'user_serial' in case document")
            return ResponseManager.bad_request(
                error="Missing 'user_serial' in case document"
            )

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
            current_app.logger.debug(
                f"failed to expand user_serial={user_serial}, "
                f"error={ResponseManager.get_error(response=user_res)}"
            )
            return user_res

        # debug success
        user_entity = ResponseManager.get_data(response=user_res)[0]
        user = user_entity.get(MongoDBEntity.USERS, {})
        case_doc["user"] = user

        current_app.logger.debug(f"returning from _expand_case_user()")

    @classmethod
    def _expand_case_responsible(cls, case_doc, office_serial):
        current_app.logger.debug(f"inside _expand_case_responsible()")

        responsible_serial = case_doc.pop("responsible_serial", None)
        if not responsible_serial:
            # debug bad request
            current_app.logger.debug(f"Missing 'responsible_serial' in case document")
            return ResponseManager.bad_request(
                error="Missing 'responsible_serial' in case document"
            )

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
            current_app.logger.debug(
                f"failed to expand responsible_serial={responsible_serial}, "
                f"error={ResponseManager.get_error(response=user_res)}"
            )
            return user_res

        # debug success
        responsible_entity = ResponseManager.get_data(response=user_res)[0]
        responsible = responsible_entity.get(MongoDBEntity.USERS, {})
        case_doc["responsible"] = responsible

        current_app.logger.debug(f"returning from _expand_case_responsible()")

    @classmethod
    def _expand_case_clients(cls, case_doc, office_serial):
        current_app.logger.debug(f"inside _expand_case_clients()")

        print(case_doc)

        clients_serials_with_roles = case_doc.pop("clients_serials_with_roles", None)
        if not clients_serials_with_roles:
            # debug bad request
            current_app.logger.debug(
                f"Missing 'clients_serials_with_roles' in case document"
            )
            return ResponseManager.bad_request(
                error="Missing 'clients_serials_with_roles' in case document"
            )

        expanded_clients = []
        current_app.logger.debug(
            f"found clients_serials_with_roles: {clients_serials_with_roles}"
        )

        for client_serial_str, role, legal_role in clients_serials_with_roles:
            client_serial = int(client_serial_str)

            # debug func call
            current_app.logger.debug(
                f"calling get_entity() from _expand_case_clients() for client_serial={client_serial}"
            )
            res = cls.get_entity(
                entity=MongoDBEntity.CLIENTS,
                office_serial=office_serial,
                filters={"serial": client_serial},
                limit=1,
                expand=False,
            )

            if not ResponseManager.is_success(response=res):
                # debug error
                current_app.logger.debug(
                    f"failed to expand client_serial={client_serial}, "
                    f"error={ResponseManager.get_error(response=res)}"
                )
                continue

            client_entities = ResponseManager.get_data(response=res)
            if not client_entities:
                # debug not found
                current_app.logger.debug(f"no client found for serial={client_serial}")
                continue

            # debug success
            client_entity = client_entities[0].get(MongoDBEntity.CLIENTS, {})
            client_entity["role"] = role
            client_entity["legal_role"] = legal_role
            expanded_clients.append(client_entity)

            current_app.logger.debug(
                f"successfully expanded client_serial={client_serial} with role={role}, and legal_role={legal_role}"
            )

        # debug success
        case_doc["clients"] = expanded_clients
        current_app.logger.debug(
            f"returning from _expand_case_clients() with {len(expanded_clients)} expanded clients"
        )

    @classmethod
    def _expand_case_files(cls, case_doc, office_serial):
        current_app.logger.debug(f"inside _expand_case_files()")

        file_serials = case_doc.pop("files_serials", None)
        if not file_serials:
            # debug bad request
            current_app.logger.debug(f"Missing 'file_serials' in case document")
            return ResponseManager.bad_request(
                error="Missing 'file_serials' in case document"
            )

        case_doc["files"] = []

        for file_serial in file_serials:
            # debug func call
            current_app.logger.debug(f"calling get_entity() from _expand_case_files()")
            file_res = cls.get_entity(
                entity=MongoDBEntity.FILES,
                office_serial=office_serial,
                filters={"serial": file_serial},
                limit=1,
                expand=False,
            )
            if ResponseManager.is_success(response=file_res):
                file_entity = ResponseManager.get_data(response=file_res)[0]
                file = file_entity.get(MongoDBEntity.FILES, {})
                case_doc["files"].append(file)

        current_app.logger.debug(f"returning from _expand_case_files()")

    @classmethod
    def _expand_case_tasks(cls, case_doc, office_serial):
        current_app.logger.debug(f"inside _expand_case_tasks()")

        task_serials = case_doc.pop("tasks_serials", None)

        # תאימות אחורה: אם אין שדה/רשימה -> נחזיר רשימת משימות ריקה ולא נשבור את התיק
        if not task_serials:
            case_doc["tasks"] = []
            current_app.logger.debug(
                "no 'tasks_serials' in case_doc; set tasks=[] and return"
            )
            return

        case_doc["tasks"] = []

        for task_serial in task_serials:
            current_app.logger.debug(
                f"calling get_entity() from _expand_case_tasks() for task_serial={task_serial}"
            )
            task_res = cls.get_entity(
                entity=MongoDBEntity.TASKS,
                office_serial=office_serial,
                filters={"serial": task_serial},
                limit=1,
                expand=False,
            )

            if not ResponseManager.is_success(response=task_res):
                current_app.logger.debug(
                    f"_expand_case_tasks(): get_entity failed for task_serial={task_serial} "
                    f"error={ResponseManager.get_error(response=task_res)}"
                )
                continue

            rows = ResponseManager.get_data(response=task_res) or []
            if not rows:
                current_app.logger.debug(
                    f"_expand_case_tasks(): no rows for task_serial={task_serial}"
                )
                continue

            # נשארים עקביים עם הקיים (כמו בקבצים): מוציאים את ה-doc מתוך ה-entity wrapper
            task_entity = rows[0].get(MongoDBEntity.TASKS, {})
            case_doc["tasks"].append(task_entity)

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
            current_app.logger.debug(f"returning bad_request: 'entity' is required")
            return ResponseManager.bad_request(error="Missing entity")

        if not office_serial:
            # debug bad request
            current_app.logger.debug(
                f"returning bad_request: 'office_serial' is required"
            )
            return ResponseManager.bad_request(error="Missing office_serial")

        if not document or not isinstance(document, dict):
            # debug bad request
            current_app.logger.debug(
                f"returning bad_request: missing or invalid 'document'"
            )
            return ResponseManager.bad_request(error="Missing or invalid document")

        db_name = str(office_serial)

        # Assign serial by entity type
        match entity:
            case cls.users_collection_name:
                counter_res = cls.get_user_counter(db_name)
            case cls.clients_collection_name:
                counter_res = cls.get_client_counter(db_name)
            case cls.cases_collection_name:
                counter_res = cls.get_case_counter(db_name)
            case cls.files_collection_name:
                counter_res = cls.get_file_counter(db_name)
            case cls.tasks_collection_name:
                counter_res = cls.get_task_counter(db_name)
            case _:
                return ResponseManager.bad_request(error=f"Unknown entity: {entity}")

        if not ResponseManager.is_success(response=counter_res):
            # debug error
            current_app.logger.debug(f"returning internal error: Failed to get counter")
            return ResponseManager.internal(error="Failed to get counter")

        # attach serial number to entity document
        serial = ResponseManager.get_data(response=counter_res)
        document["serial"] = serial

        # insert into DB
        collection = cls._get_collection(db_name, entity)
        result = collection.insert_one(document)

        # debug success
        current_app.logger.debug(
            f"Created new {entity} with serial={serial} in DB {db_name}"
        )
        current_app.logger.debug(f"returning success with serial={serial}")
        return ResponseManager.success(data=serial)

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
            current_app.logger.debug("returning bad_request: 'entity' is required")
            return ResponseManager.bad_request(error="Missing 'entity'")

        if not filters:
            # debug bad request
            current_app.logger.debug(
                "returning bad_request: 'filters' are required for delete"
            )
            return ResponseManager.bad_request(error="Missing 'filters'")

        results = []
        db_names = (
            [str(office_serial)] if office_serial else list(cls._iter_tenant_dbs())
        )
        current_app.logger.debug(f"db_names: {db_names}")

        total_deleted = 0

        for db_name in db_names:

            # debug func call
            current_app.logger.debug(f"calling delete_records() for DB '{db_name}'")
            delete_res = cls._delete_records(
                db_name=db_name, collection_name=entity, filters=filters
            )

            if not ResponseManager.is_success(response=delete_res):
                # debug error from delete records
                current_app.logger.debug(
                    f"skipping DB '{db_name}' due to response error: "
                    f"{ResponseManager.get_error(response=delete_res)}"
                )
                continue

            deleted_count = ResponseManager.get_data(response=delete_res)
            total_deleted += deleted_count

            results.append(
                {"office_serial": int(db_name), "deleted_count": deleted_count}
            )

        if total_deleted == 0:
            # debug not found
            current_app.logger.debug(
                f"no entities deleted for {entity} with filters {filters}"
            )
            current_app.logger.debug(f"returning not found")
            return ResponseManager.not_found(
                error=f"No matching {entity} found to delete"
            )

        # debug success
        current_app.logger.debug(
            f"returning success with results and total_deleted={total_deleted}"
        )
        return ResponseManager.success(
            data={"total_deleted": total_deleted, "details": results}
        )

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
            current_app.logger.debug("returning bad_request: 'entity' is required")
            return ResponseManager.bad_request("Missing 'entity'")
        if not filters:
            # debug bad request
            current_app.logger.debug("returning bad_request: 'filters' is required")
            return ResponseManager.bad_request("Missing 'filters'")
        if not update_data:
            # debug bad request
            current_app.logger.debug("returning bad_request: 'update_data' is required")
            return ResponseManager.bad_request("Missing 'update_data'")

        db_names = (
            [str(office_serial)] if office_serial else list(cls._iter_tenant_dbs())
        )
        total_modified = 0
        results = []

        for db_name in db_names:

            # debug func call
            current_app.logger.debug(f"calling _update_fields() for DB '{db_name}'")
            update_res = cls._update_fields(
                db_name=db_name,
                collection_name=entity,
                filters=filters,
                update_data=update_data,
                multiple=multiple,
                operator=operator,
            )

            if not ResponseManager.is_success(update_res):
                # debug error from delete records
                current_app.logger.debug(
                    f"skipping DB '{db_name}' due to response error: "
                    f"{ResponseManager.get_error(response=update_res)}"
                )
                continue

            modified = ResponseManager.get_data(update_res)
            total_modified += modified

            results.append({"office_serial": int(db_name), "modified": modified})

        if total_modified == 0:
            # debug not found
            current_app.logger.debug(f"No {entity} updated with filters {filters}")
            current_app.logger.debug(f"returning not found")
            return ResponseManager.not_found(
                error=f"No matching {entity} found to update"
            )

        # debug success
        current_app.logger.debug(
            f"returning success with results and total_modified={total_modified}"
        )
        return ResponseManager.success(
            data={"total_modified": total_modified, "details": results}
        )

    # ------------------------ Counters -------------------------

    @classmethod
    def _get_next_counter(cls, db_name: str, counter_name: str) -> tuple:

        current_app.logger.debug(f"inside _get_next_counter()")
        # debug inputs
        current_app.logger.debug(f"db_name: {db_name}")
        current_app.logger.debug(f"counter_name: {counter_name}")

        """
        Atomically increments and returns the next sequence value for a counter.

        Commonly used for generating unique serials (e.g., user IDs, case IDs).

        Args:
            db_name (str): The tenant (office) database name.
            counter_name (str): The counter key (e.g., "user_counter").

        Returns:
            ResponseManager: success with new counter value, or error response.
        """
        if not db_name:
            # debug bad request
            current_app.logger.debug(f"returning bad_request: 'db_name' is required")
            return ResponseManager.bad_request(error="'db_name' is required")

        if not counter_name:
            # debug bad request
            current_app.logger.debug(
                f"returning bad_request: 'counter_name' is required"
            )
            return ResponseManager.bad_request(error="'counter_name' is required")

        collection = cls._get_collection(db_name, "counters")

        result = collection.find_one_and_update(
            {"_id": counter_name},
            {"$inc": {"value": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

        if not result or "value" not in result:
            # debug error
            current_app.logger.debug(
                f"returning internal error: Counter '{counter_name}' could not be incremented"
            )
            return ResponseManager.internal(
                error=f"Counter '{counter_name}' could not be incremented"
            )

        new_value = int(result["value"])

        # debug success
        current_app.logger.info(
            f"[{db_name}@counters] Incremented '{counter_name}' to {new_value}"
        )
        current_app.logger.debug(f"returning success with value={new_value}")
        return ResponseManager.success(data=new_value)

    # ---------- Tenant ----------
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

    # ---------- Global ----------
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
            current_app.logger.debug(
                f"returning bad_request: 'office_serial' is required"
            )
            return ResponseManager.bad_request(error="'office_serial' is required")

        client = cls._get_client()
        db_name = str(office_serial)

        if db_name in client.list_database_names():
            # debug conflict
            current_app.logger.debug(
                f"returning conflict: DB '{db_name}' already exists"
            )
            return ResponseManager.conflict(error=f"DB '{db_name}' already exists")

        # debug func call
        current_app.logger.debug(
            f"calling ensure_indexes() from _create_office_database()"
        )
        cls.ensure_indexes(db_name)  # Ensure all required indexes exist

        # Initialize counter collection
        counters = cls._get_collection(db_name, cls.counters_collection_name)
        counter_names = [
            cls.user_counter_name,
            cls.case_counter_name,
            cls.client_counter_name,
            cls.file_counter_name,
            cls.task_counter_name,
        ]

        for name in counter_names:
            counters.update_one(
                {"_id": name}, {"$setOnInsert": {"value": 0}}, upsert=True
            )

        # debug success
        current_app.logger.info(
            f"[DB] [{db_name}] Office created and initialized successfully"
        )
        current_app.logger.info(f"returning success with db name: {db_name}")
        return ResponseManager.success(data={"db_name": db_name})

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
            current_app.logger.debug(
                f"returning bad_request: 'office_name' is required"
            )
            return ResponseManager.bad_request(
                error="'office_name' is required for get_office_serial()"
            )

        db_name = cls.MONGO_OFFICES_DB_NAME
        collection_name = cls.offices_collection_name

        collection = cls._get_collection(db_name, collection_name)
        doc = collection.find_one(
            {"office_name": office_name}, {"_id": 0, "office_serial": 1}
        )

        if doc and "office_serial" in doc:
            office_serial = doc["office_serial"]
            # debug success
            current_app.logger.info(
                f"[DB@Col] [{db_name}@{collection_name}] Found office_serial='{office_serial}'"
            )
            current_app.logger.info(
                f"returning success with office_serial: {office_serial}"
            )
            return ResponseManager.success(data=office_serial)

        # debug not found
        current_app.logger.debug(
            f"[DB@Col] [{db_name}@{collection_name}] No record found with office_name='{office_name}'"
        )
        current_app.logger.info(f"returning not found")
        return ResponseManager.not_found(error=f"Office '{office_name}' not found")

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
            current_app.logger.debug(
                f"returning bad_request: 'office_serial' is required"
            )
            return ResponseManager.bad_request(error="'office_serial' is required")

        db_name = cls.MONGO_OFFICES_DB_NAME
        collection_name = cls.offices_collection_name

        collection = cls._get_collection(db_name, collection_name)
        doc = collection.find_one(
            {"office_serial": office_serial}, {"_id": 0, "office_name": 1}
        )

        if doc and "office_name" in doc:
            office_name = doc["office_name"]
            # debug success
            current_app.logger.info(
                f"[DB@Col] [{db_name}@{collection_name}] Found office_name='{office_name}'"
            )
            current_app.logger.info(
                f"returning success with office_name: {office_name}"
            )
            return ResponseManager.success(data=office_name)

        # debug not found
        current_app.debug(
            f"[DB@Col] [{db_name}@{collection_name}] No record found with office_serial='{office_serial}'"
        )
        current_app.logger.debug(f"returning not found")
        return ResponseManager.not_found(error=f"Office '{office_serial}' not found")

    @classmethod
    def get_or_create_office_serial(cls, office_name: str):
        """
        Retrieve the existing office_serial for the given office_name.
        If the office does not exist, create a new office entry with
        a unique serial and initialize its own database.

        Args:
            office_name (str): The office name to look up or create.
        """
        current_app.logger.debug(f"inside get_or_create_office_serial()")
        # debug inputs
        current_app.logger.debug(f"office_name: {office_name}")

        if not office_name:
            # debug bad request
            current_app.logger.debug(
                f"returning bad_request: 'office_name' is required"
            )
            return ResponseManager.bad_request(error="'office_name' is required")

        db_name = cls.MONGO_OFFICES_DB_NAME
        collection_name = cls.offices_collection_name

        # Try to find existing office
        collection = cls._get_collection(db_name, collection_name)
        existing = collection.find_one(
            {"office_name": office_name}, {"_id": 0, "office_serial": 1}
        )

        if existing:
            office_serial = existing["office_serial"]
            # debug success
            current_app.logger.info(
                f"[DB@Col] [{db_name}@{collection_name}] Found existing office with office_name='{office_name}'"
            )
            current_app.logger.info(
                f"returning success with office_serial: {office_serial}"
            )
            return ResponseManager.success(data={"office_serial": office_serial})

        # Create new office if not found
        new_office_serial_res = cls.get_offices_counter()

        if not ResponseManager.is_success(response=new_office_serial_res):
            # debug error
            current_app.logger.debug(f"returning internal error: Failed to get counter")
            return ResponseManager.internal(error="Failed to get counter")

        new_office_serial = ResponseManager.get_data(response=new_office_serial_res)

        if new_office_serial == -1:
            # debug error
            current_app.logger.debug(
                f"returning internal error: Failed to generate office serial"
            )
            return ResponseManager.internal(error="Failed to generate office serial")

        # Insert into global offices registry
        collection.insert_one(
            {"office_name": office_name, "office_serial": str(new_office_serial)}
        )
        # debug insertion
        current_app.logger.info(
            f"Added new office '{office_name}' with serial={new_office_serial}"
        )

        # Create a dedicated database for this office
        # debug func call
        current_app.logger.info(
            f"calling _create_office_database() from get_or_create_office_serial()"
        )
        create_res = cls._create_office_database(new_office_serial)

        if not ResponseManager.is_success(response=create_res):
            # debug deletion
            current_app.logger.debug(
                f"delete the office name and serial from collection"
            )
            collection.delete_one({"office_name": office_name})
            # debug error
            current_app.logger.debug(
                f"returning internal error: Failed to initialize office DB"
            )
            return ResponseManager.internal(error="Failed to initialize office DB")

        # debug success
        current_app.logger.info(
            f"Created and initialized [DB] [{new_office_serial}] for '{office_name}'"
        )
        current_app.logger.info(
            f"returning success with office_serial: {new_office_serial}"
        )
        return ResponseManager.success(data={"office_serial": new_office_serial})

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
