"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("email", ASCENDING)], name="email", unique=True)],
    "sessions": [
        IndexModel([("token", ASCENDING)], name="token", unique=True),
        IndexModel([("expires_at", ASCENDING)], name="expires_ttl", expireAfterSeconds=0),
    ],
    "products": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("sku", ASCENDING)], name="sku"),
                 IndexModel([("category", ASCENDING), ("name", ASCENDING)], name="cat_name")],
    "materials": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("kind", ASCENDING), ("name", ASCENDING)], name="kind_name")],
    "roasts": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("date", DESCENDING)], name="date")],
    "contacts": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("type", ASCENDING), ("name", ASCENDING)], name="type_name")],
    "sales": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("date", DESCENDING)], name="date"),
              IndexModel([("customer_id", ASCENDING), ("date", DESCENDING)], name="customer_date")],
    "accounts": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "transactions": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("account_id", ASCENDING), ("date", DESCENDING)], name="acc_date"),
                     IndexModel([("ref_id", ASCENDING)], name="ref")],
    "cari_movements": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("contact_id", ASCENDING), ("date", DESCENDING)], name="contact_date"),
                       IndexModel([("ref_id", ASCENDING)], name="ref")],
    "expenses": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("date", DESCENDING)], name="date")],
    "counters": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "settings": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
