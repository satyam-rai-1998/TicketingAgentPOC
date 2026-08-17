-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tickets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "requester_name" TEXT NOT NULL,
    "requester_email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "type" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "group_name" TEXT,
    "assignee" TEXT,
    "tags" TEXT,
    "classification_result" TEXT,
    "confidence_score" REAL,
    "compliance_status" TEXT NOT NULL DEFAULT 'none',
    "flag_type" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_tickets" ("assignee", "channel", "classification_result", "compliance_status", "confidence_score", "created_at", "description", "flag_type", "group_name", "id", "priority", "requester_email", "requester_name", "status", "subject", "tags", "type", "updated_at") SELECT "assignee", "channel", "classification_result", "compliance_status", "confidence_score", "created_at", "description", "flag_type", "group_name", "id", "priority", "requester_email", "requester_name", "status", "subject", "tags", "type", "updated_at" FROM "tickets";
DROP TABLE "tickets";
ALTER TABLE "new_tickets" RENAME TO "tickets";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
