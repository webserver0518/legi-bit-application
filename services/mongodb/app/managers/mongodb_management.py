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
            raise ValueError("db_name is required")

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
            raise ValueError("db_name is required")

        if not collection_name:
            # debug bad request
            current_app.logger.debug(f"bad_request: 'collection_name' is required")
            raise ValueError("collection_name is required")

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

        # debug inputs
        msg = f"inside _get_records(), inputs: " \
              f"db_name={db_name}, " \
              f"collection_name={collection_name}, " \
              f"filters={filters}, projection={projection}, " \
              f"sort={sort if sort else 'None'}, " \
              f"limit={'unlimited' if limit == 0 else limit}, "

        if not db_name:
            # debug bad request
            msg += f"'db_name' is required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)
        if not collection_name:
            # debug bad request
            msg += f"'collection_name' is required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        try:
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
        except Exception as e:
            # debug error
            msg += f"error from _get_records(): {e}"
            current_app.logger.error(msg)
            return ResponseManager.error(str(e))

        if len(results) == 0:
            # debug no content
            msg += f"no content from _get_records()"
            current_app.logger.debug(msg)
            return ResponseManager.no_content(message=msg)

        # debug success
        msg += f"success with results from _get_records()"
        current_app.logger.debug(msg)
        return ResponseManager.success(data=results, message=msg)

    # ---------- Creates -----------
    @classmethod
    def _create_records(
        cls,
        db_name: str,
        collection_name: str,
        documents: dict | list[dict],
    ):
        """
        Insert one or multiple documents into a MongoDB collection.

        Args:
            db_name (str): Database name.
            collection_name (str): Collection name.
            documents (dict | list[dict]): Document or list of documents to insert.

        Returns:
            ResponseManager: success with inserted IDs count, or error response.
        """

        msg = (
            f"inside _create_records(), inputs: "
            f"db_name={db_name}, "
            f"collection_name={collection_name}, "
            f"documents_type={'list' if isinstance(documents, list) else 'dict'}, "
        )

        # ------------ Basic validation ------------
        if not db_name:
            msg += "'db_name' is required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        if not collection_name:
            msg += "'collection_name' is required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        if not documents:
            msg += "'documents' is required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        try:
            collection = cls._get_collection(db_name, collection_name)

            # Normalize to list
            if isinstance(documents, dict):
                documents = [documents]

            # Insert many docs
            result = collection.insert_many(documents)

            inserted_count = len(result.inserted_ids)

        except Exception as e:
            msg += f"error from _create_records(): {e}"
            current_app.logger.error(msg)
            return ResponseManager.error(str(e))

        if inserted_count == 0:
            msg += "no content from _create_records()"
            current_app.logger.debug(msg)
            return ResponseManager.no_content(message=msg)

        msg += f"success with inserted_count={inserted_count} from _create_records()"
        current_app.logger.debug(msg)
        return ResponseManager.created(data=inserted_count, message=msg)


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
        msg = f"inside _update_fields(), inputs: " \
              f"db_name={db_name}, " \
              f"collection_name={collection_name}, " \
              f"filters={filters}, update_data={update_data}, " \
              f"multiple={multiple}, operator={operator}, "

        if not db_name:
            msg += f"'db_name' is required"
            # debug bad request
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        if not collection_name:
            # debug bad request
            msg += f"'collection_name' is required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        if not operator.startswith("$"):
            # debug bad request
            msg += f"Invalid MongoDB operator (must start with '$')"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        try:
            collection = cls._get_collection(db_name, collection_name)
            update_query = {operator: update_data}

            if multiple:
                result = collection.update_many(filters, update_query)
            else:
                result = collection.update_one(filters, update_query)

            modified = result.modified_count
        except Exception as e:
            # debug error
            msg += f"error from _update_fields(): {e}"
            current_app.logger.error(msg)
            return ResponseManager.error(str(e))

        if modified == 0:
            # debug no content
            msg += f"no content from _update_fields()"
            current_app.logger.debug(msg)
            return ResponseManager.no_content(message=msg)

        # debug success
        msg += f"success with modified count from _update_records()"
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

        msg = f"inside _delete_records(), inputs: " \
              f"db_name={db_name}, " \
              f"collection_name={collection_name}, " \
              f"filters={filters}, "

        if not db_name:
            msg += f"'db_name' is required"
            # debug bad request
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        if not collection_name:
            # debug bad request
            msg += f"'collection_name' is required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        try:
            collection = cls._get_collection(db_name, collection_name)
            filters = filters or {}

            result = collection.delete_many(filters)
            deleted_count = result.deleted_count
        except Exception as e:
            # debug error
            msg += f"error from _delete_records(): {e}"
            current_app.logger.error(msg)
            return ResponseManager.error(str(e))

        if deleted_count == 0:
            # debug no content
            msg += f"no content from _delete_records()"
            current_app.logger.debug(msg)
            return ResponseManager.no_content(message=msg)

        # debug success
        msg += f"success with deleted count from _delete_records()"
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

        msg = f"inside ensure_indexes(), inputs: " \
              f"db_name={db_name}, "
        
        if not db_name:
            # debug bad request
            msg += f"'db_name' is required"
            current_app.logger.warning(msg)
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
            try: 
                collection = cls._get_collection(db_name, collection_name)

                collection.create_index("serial", unique=True)

                if collection_name == cls.users_collection_name:
                    collection.create_index("username", unique=True)

                if collection_name == cls.profiles_collection_name:
                    collection.create_index("name", unique=True)

                for idx in collection.list_indexes():
                    created_indexes.append(f"{collection_name}.{idx['name']}")

            except Exception as e:
                # debug error
                msg += f"error from ensure_indexes() on collection '{collection_name}': {e}"
                current_app.logger.error(msg)
                return ResponseManager.error(str(e))
            
        if len(created_indexes) == 0:
            # debug no content
            msg += f"no content from ensure_indexes()"
            current_app.logger.debug(msg)
            return ResponseManager.no_content(message=msg)

        # debug success
        msg += f"success with ensured indexes in db='{db_name}' from ensured_indexes()"
        current_app.logger.debug(msg)
        return ResponseManager.success(data=created_indexes, message=msg)

    # ------------------------ Entity Helpers -------------------------

    @classmethod
    def search_entities(
        cls,
        entity: str,
        office_serial: int = None,
        filters: dict = None,
        projection: dict = None,
        sort: tuple[str, int] = None,
        limit: int = 0,
        expand: bool = False,
    ):

        current_app.logger.debug(f"inside search_entities()")

        if not entity:
            msg = f"'entity' is required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        results = []
        db_names = (
            [str(office_serial)] if office_serial else list(cls._iter_tenant_dbs())
        )

        # debug db names
        msg = f"db_names: {db_names}"
        current_app.logger.debug(msg)

        for db_name in db_names:

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
                current_app.logger.warning(msg)
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
            msg = f"no content from search_entities()"
            current_app.logger.debug(msg)
            return ResponseManager.no_content(message=msg)

        # debug success
        msg = f"success with results[] from search_entities()"
        current_app.logger.debug(msg)
        return ResponseManager.success(data=results, message=msg)

    @classmethod
    def _expand_case_user(cls, case_doc, office_serial):
        current_app.logger.debug(f"inside _expand_case_user()")

        user_serial = case_doc.pop("user_serial", None)
        if not user_serial:
            # debug bad request
            msg = f"Missing 'user_serial' in case document"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        case_doc["user"] = {}

        user_res = cls.search_entities(
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
            current_app.logger.warning(msg)
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

        user_res = cls.search_entities(
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
            current_app.logger.warning(msg)
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

        clients_serials_with_roles = case_doc.pop("clients_serials_with_roles", [])
        if not clients_serials_with_roles:
            # debug bad request
            msg = f"Missing 'clients_serials_with_roles' in case document"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        msg = f"found clients_serials_with_roles: {clients_serials_with_roles}"
        current_app.logger.debug(msg)

        for client_serial_str, role, legal_role in clients_serials_with_roles:
            client_serial = int(client_serial_str)

            clients_res = cls.search_entities(
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
                current_app.logger.warning(msg)
                continue

            if ResponseManager.is_no_content(response=clients_res):
                # debug no content
                msg = f"no content from _expand_case_clients() on client_serial={client_serial}"
                current_app.logger.debug(msg)
                continue

            # debug success
            clients = ResponseManager.get_data(response=clients_res)
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

        files_serials = case_doc.pop("files_serials", [])
        if not files_serials:
            # debug bad request
            msg = f"Missing 'files_serials' in case document"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        for file_serial_str in files_serials:
            file_serial = int(file_serial_str)

            files_res = cls.search_entities(
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
                current_app.logger.warning(msg)
                continue

            if ResponseManager.is_no_content(response=files_res):
                # debug no content
                msg = f"no content from _expand_case_files() on file_serial={file_serial}"
                current_app.logger.debug(msg)
                continue

            # debug success
            files = ResponseManager.get_data(response=files_res)
            file = files[0]
            case_doc["files"].append(file)

            msg = f"successfully expanded file_serial={file_serial}"
            current_app.logger.debug(msg)

        msg = f"returning from _expand_case_files()"
        current_app.logger.debug(msg)

    @classmethod
    def _expand_case_tasks(cls, case_doc, office_serial):
        current_app.logger.debug(f"inside _expand_case_tasks()")

        case_doc["tasks"] = []

        tasks_serials = case_doc.pop("tasks_serials", [])
        if not tasks_serials:
            # debug bad request
            msg = f"Missing 'tasks_serials' in case document"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        for task_serial in tasks_serials:
            msg = f"calling search_entities() from _expand_case_tasks() for task_serial={task_serial}"
            current_app.logger.debug(msg)

            tasks_res = cls.search_entities(
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
                current_app.logger.warning(msg)
                continue
            
            if ResponseManager.is_no_content(response=tasks_res):
                # debug no content
                msg = f"no content from _expand_case_tasks() on task_serial={task_serial}"
                current_app.logger.debug(msg)
                continue

            # debug success
            tasks = ResponseManager.get_data(response=tasks_res)
            task = tasks[0]
            case_doc["tasks"].append(task)

            msg = f"successfully expanded task_serial={task_serial}"
            current_app.logger.debug(msg)

        msg = f"returning from _expand_case_tasks()"
        current_app.logger.debug(msg)

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

        if not entity:
            # debug bad request
            msg = f"'entity' is required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        if not office_serial:
            # debug bad request
            msg = f"'office_serial' is required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        if not document or not isinstance(document, dict):
            # debug bad request
            msg = f"returning bad_request: missing or invalid 'document'"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        db_name = str(office_serial)

        # Assign serial by entity type
        counter_res = MongoDBManager.get_entity_counter(entity=entity, db_name=db_name)
        if not ResponseManager.is_success(response=counter_res):
            # debug error
            error_res = ResponseManager.get_error(response=counter_res)
            msg_res = ResponseManager.get_message(response=counter_res)
            msg = f"failed to get counter, result details: [error - {error_res}, message - {msg_res}]"
            current_app.logger.warning(msg)
            return counter_res

        # attach serial number to entity document
        serial = ResponseManager.get_data(response=counter_res)
        document["serial"] = serial

        # insert into DB
        create_res = cls._create_records(
            db_name=db_name,
            collection_name=entity,
            documents=document,
        )

        if not ResponseManager.is_success(response=create_res):
            # debug error from create records
            error_res = ResponseManager.get_error(response=create_res)
            msg_res = ResponseManager.get_message(response=create_res)
            msg = f"failed to create entity in DB '{db_name}', result details: [error - {error_res}, message - {msg_res}]"
            current_app.logger.warning(msg)
            return create_res
        
        if ResponseManager.is_no_content(response=create_res):
            return create_res

        # debug success
        msg = f"created new {entity} with serial={serial} in DB {db_name}"
        current_app.logger.debug(msg)
        return ResponseManager.created(data=serial, message=msg)

    @classmethod
    def delete_entities(
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

        current_app.logger.debug("inside delete_entities()")

        if not entity:
            # debug bad request
            msg = f"'entity' is required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        if not office_serial:
            # debug bad request
            msg = f"'office_serial' is required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        if not filters:
            # debug bad request
            msg = f"'filters' are required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        db_name = str(office_serial)

        delete_res = cls._delete_records(
            db_name=db_name, collection_name=entity, filters=filters
        )

        if not ResponseManager.is_success(response=delete_res):
            # debug error from delete records
            error_res = ResponseManager.get_error(response=delete_res)
            msg_res = ResponseManager.get_message(response=delete_res)
            msg = f"skipping DB '{db_name}', result details: [error - {error_res}, message - {msg_res}]"
            current_app.logger.warning(msg)
            return delete_res
        
        if ResponseManager.is_no_content(response=delete_res):
            return delete_res

        deleted_count = ResponseManager.get_data(response=delete_res)
        
        # debug success
        msg = f"success with results from delete_entities()"
        current_app.logger.debug(msg)
        return ResponseManager.success(data=deleted_count, message=msg)

    @classmethod
    def update_entities(
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

        current_app.logger.debug("inside update_entities()")

        if not entity:
            # debug bad request
            msg = f"'entity' is required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        if not filters:
            # debug bad request
            msg = f"'filters' are required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        if not update_data:
            # debug bad request
            msg = f"'update_data' are required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        db_names = (
            [str(office_serial)] if office_serial else list(cls._iter_tenant_dbs())
        )
        total_modified = 0
        results = []

        for db_name in db_names:

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
                current_app.logger.warning(msg)
                continue

            modified_count = ResponseManager.get_data(response=update_res)
            total_modified += modified_count

            results.append(
                {"office_serial": int(db_name), "modified_count": modified_count}
            )

        if total_modified == 0:
            # debug no content
            msg = f"no content from update_entities()"
            current_app.logger.debug(msg)
            return ResponseManager.no_content(message=msg)

        # debug success
        msg = f"success with results from update_entities()"
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

        msg = f"inside _get_next_counter(), inputs: " \
              f"db_name={db_name}, " \
              f"counter_name={counter_name}, "
        
        if not db_name:
            # debug bad request
            msg += f"'db_name' is required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        if not counter_name:
            # debug bad request
            msg += f"'counter_name' are required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        try: 
            collection = cls._get_collection(db_name, cls.counters_collection_name)

            result = collection.find_one_and_update(
                {"_id": counter_name},
                {"$inc": {"value": 1}},
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
        except Exception as e:
            # debug error
            msg += f"error from _get_next_counter(): {e}"
            current_app.logger.error(msg)
            return ResponseManager.error(str(e))

        if not result or "value" not in result:
            # debug error
            msg += f"counter '{counter_name}' could not be incremented"
            current_app.logger.debug(msg)
            return ResponseManager.internal(message=msg)

        new_value = int(result["value"])

        # debug success
        msg += f"success with new value from _get_next_counter()"
        current_app.logger.debug(msg)
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
    def search_offices(
        cls, 
        filters: dict = None,
        projection: dict = None,
        sort: tuple[str, int] = None,
        limit: int = 0,
    ):
        """
        Return all offices from the global offices registry.
        """
        msg = f"inside search_offices()"

        offices_res = cls._get_records(
            db_name=cls.MONGO_OFFICES_DB_NAME,
            collection_name=cls.offices_collection_name,
            filters=filters,
            projection=projection,
            sort=sort,
            limit=limit,
        )

        if not ResponseManager.is_success(response=offices_res):
            # debug error
            error_res = ResponseManager.get_error(response=offices_res)
            msg_res = ResponseManager.get_message(response=offices_res)
            msg += f"failed to get offices, result details: [error - {error_res}, message - {msg_res}]"
            current_app.logger.debug(msg)
            return offices_res
        
        if ResponseManager.is_no_content(response=offices_res):
            return offices_res

        # debug success
        msg += f"success with offices"
        current_app.logger.debug(msg)
        return offices_res
    
    @classmethod
    def _create_office_database(cls, serial: str):
        """
        Initialize a new office (tenant) database with required indexes and counters.

        Args:
            office_serial (str): The unique serial (identifier) of the office.

        Returns:
            ResponseManager: success with db_name, or error response.

        """

        msg = f"inside _create_office_database(), inputs: " \
              f"db_name={serial}, "

        if not serial:
            # debug bad request
            msg += f"'serial' is required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        client = cls._get_client()
        db_name = str(serial)

        if db_name in client.list_database_names():
            # debug conflict
            msg = f"DB '{db_name}' already exists"
            current_app.logger.warning(msg)
            return ResponseManager.conflict(message=msg)

        # Ensure indexes for all collections
        cls.ensure_indexes(db_name)

        # Initialize counter collection
        try:
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
        except Exception as e:
            # debug error
            msg += f"error from _create_office_database() while initializing counters: {e}"
            current_app.logger.error(msg)
            return ResponseManager.error(str(e))

        # debug success
        msg = f"created new office= {db_name} and initialized successfully"
        current_app.logger.debug(msg)
        return ResponseManager.created(message=msg)

    @classmethod
    def create_office(cls, name: str = ""):
        """
        Always creates a new office:
        - gets new office_serial from global counter
        - inserts into offices_db.offices_col
        - initializes tenant DB with counters=0 and indexes
        """
        msg = f"inside create_office(), inputs: " \
              f"name={name}, "

        if not name:
            # debug bad request
            msg += f"'name' is required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        # allocate new serial
        counter_res = cls.get_offices_counter()
        if not ResponseManager.is_success(response=counter_res):
            # debug error
            error_res = ResponseManager.get_error(response=counter_res)
            msg_res = ResponseManager.get_message(response=counter_res)
            msg += f"failed to get counter, result details: [error - {error_res}, message - {msg_res}]"
            current_app.logger.warning(msg)
            return counter_res

        serial_str = ResponseManager.get_data(response=counter_res)
        serial = int(serial_str)


        office_doc = {"serial": serial, "name": name}
        create_res = MongoDBManager._create_records(
            db_name=cls.MONGO_OFFICES_DB_NAME,
            collection_name=cls.offices_collection_name,
            documents=office_doc
        )

        if not ResponseManager.is_success(response=create_res):
            # debug error
            error_res = ResponseManager.get_error(response=create_res)
            msg_res = ResponseManager.get_message(response=create_res)
            msg += f"failed to create office record, result details: [error - {error_res}, message - {msg_res}]"
            current_app.logger.warning(msg)
            return create_res
        
        if ResponseManager.is_no_content(response=create_res):
            return create_res

        # create tenant DB + counters=0
        create_res = cls._create_office_database(serial)
        if not ResponseManager.is_success(response=create_res):
            # rollback registry insert
            msg += f"rolling back registry insert due to failure in creating tenant DB"
            current_app.logger.warning(msg)
            MongoDBManager._delete_records(
                db_name=cls.MONGO_OFFICES_DB_NAME,
                collection_name=cls.offices_collection_name,
                filters={"serial": serial}
            )
            return create_res

        # debug success
        msg += f"success with office serial"
        current_app.logger.debug(msg)
        return ResponseManager.success(data=serial, message=msg)

    @classmethod
    def delete_office(cls, serial: int):
        msg = f"inside delete_office(), inputs: serial={serial}"

        if not serial:
            # debug bad request
            msg += f"'serial' is required"
            current_app.logger.warning(msg)
            return ResponseManager.bad_request(message=msg)

        serial = int(serial)

        # verify exists in registry
        # delete registry record
        delete_res = cls._delete_records(
            db_name=cls.MONGO_OFFICES_DB_NAME,
            collection_name=cls.offices_collection_name,
            filters={"serial": serial},
        )

        if not ResponseManager.is_success(response=delete_res):
            # debug error
            error_res = ResponseManager.get_error(response=delete_res)
            msg_res = ResponseManager.get_message(response=delete_res)
            msg += f"failed to delete office record, result details: [error - {error_res}, message - {msg_res}]"
            current_app.logger.warning(msg)
            return delete_res
        
        if ResponseManager.is_no_content(response=delete_res):
            return delete_res

        db_name = str(serial)

        # drop tenant db
        try:
            cls._get_client().drop_database(db_name)
        except Exception as e:
            msg += f"stand alone DB!, failed dropping tenant db '{db_name}': {e}"
            current_app.logger.error(msg)
            return ResponseManager.error(message=msg)

        # debug success
        msg += f"successfully deleted office with serial={serial}"
        current_app.logger.debug(msg)
        return ResponseManager.success(message=msg)

    # ---------------------- Login ----------------------

    # ---------- Admin ----------
    @classmethod
    def get_admin_passwords(cls):
        msg = f"inside get_admin_passwords()"
        current_app.logger.debug(msg)

        db_name = cls.MONGO_ADMINS_DB_NAME
        collection_name = cls.admin_login_collection_name

        admin_passwords_hashes_res = cls._get_records(
            db_name=db_name,
            collection_name=collection_name,
            projection={"_id": 0, "password_hash": 1},
        )

        if not ResponseManager.is_success(response=admin_passwords_hashes_res):
            # debug error
            error_res = ResponseManager.get_error(response=admin_passwords_hashes_res)
            msg_res = ResponseManager.get_message(response=admin_passwords_hashes_res)
            msg += f"failed to get counter, result details: [error - {error_res}, message - {msg_res}]"
            current_app.logger.warning(msg)
            return admin_passwords_hashes_res
        
        if ResponseManager.is_no_content(response=admin_passwords_hashes_res):
            return admin_passwords_hashes_res

        passwords_hashes = ResponseManager.get_data(response=admin_passwords_hashes_res)

        # debug success
        msg += f"success with passwords from get_admin_passwords()"
        current_app.logger.debug(msg)
        return ResponseManager.success(data=passwords_hashes)
