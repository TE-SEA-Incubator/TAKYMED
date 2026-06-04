import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find the project root robustly (works whether in src/server or dist/server)
const projectRoot = __dirname.includes('dist') ? path.join(__dirname, "../../") : path.join(__dirname, "../");

// Path to our SQLite database file
const dbPath = process.env.DB_PATH || path.join(projectRoot, "bd.sqlite");
const sqlScriptPath = path.join(projectRoot, "bd.sql");

// Create or open the database
export const db = new Database(dbPath, {
    verbose: process.env.DEBUG_SQL === 'true' ? console.log : undefined
});

// Enable modern SQLite features for better performance and safety
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/**
 * Initializes the database by running the bd.sql script if the tables don't exist.
 */
export function initializeDatabase() {
    try {
        console.log("Applying database schema from bd.sql...");
        const sqlScript = fs.readFileSync(sqlScriptPath, "utf-8");
        db.exec(sqlScript);
        console.log("Database schema applied successfully.");
        console.log("Database tables already exist. Skipping initialization.");

        // Check for missing columns in Medicaments (Migration)
        const medicamentColumns = db.prepare("PRAGMA table_info(Medicaments)").all() as { name: string }[];
        const hasDateAjout = medicamentColumns.some(c => c.name === 'date_ajout');
        const hasPrix = medicamentColumns.some(c => c.name === 'prix');

        if (!hasDateAjout) {
            console.log("Adding date_ajout column to Medicaments...");
            db.exec("ALTER TABLE Medicaments ADD COLUMN date_ajout DATETIME DEFAULT CURRENT_TIMESTAMP");
        }
        if (!hasPrix) {
            console.log("Adding prix column to Medicaments...");
            db.exec("ALTER TABLE Medicaments ADD COLUMN prix VARCHAR(50)");
        }

        // Create InteractionsMedicaments table if missing
        db.exec(`
                CREATE TABLE IF NOT EXISTS InteractionsMedicaments (
                    id_interaction INTEGER PRIMARY KEY AUTOINCREMENT,
                    medicament_source INT NOT NULL,
                    medicament_interdit INT NOT NULL,
                    niveau_risque VARCHAR(20) DEFAULT 'modere',
                    description TEXT,
                    FOREIGN KEY (medicament_source) REFERENCES Medicaments(id_medicament) ON DELETE CASCADE,
                    FOREIGN KEY (medicament_interdit) REFERENCES Medicaments(id_medicament) ON DELETE CASCADE
                )
            `);

        // Check for missing columns in Pharmacies (Migration)
        const pharmacyColumns = db.prepare("PRAGMA table_info(Pharmacies)").all() as { name: string }[];
        const hasLat = pharmacyColumns.some(c => c.name === 'latitude');
        const hasLng = pharmacyColumns.some(c => c.name === 'longitude');

        if (!hasLat) {
            console.log("Adding latitude column to Pharmacies...");
            db.exec("ALTER TABLE Pharmacies ADD COLUMN latitude REAL");
        }
        if (!hasLng) {
            console.log("Adding longitude column to Pharmacies...");
            db.exec("ALTER TABLE Pharmacies ADD COLUMN longitude REAL");
        }

        // New Migrations for Phase 8
        const ordonnanceColumns = db.prepare("PRAGMA table_info(Ordonnances)").all() as { name: string }[];
        const hasCategorieAge = ordonnanceColumns.some(c => c.name === 'categorie_age');
        if (!hasCategorieAge) {
            console.log("Adding categorie_age column to Ordonnances...");
            db.exec("ALTER TABLE Ordonnances ADD COLUMN categorie_age TEXT DEFAULT 'adulte'");
        }

        // New Migrations for Phase 14
        const typeComptesColumns = db.prepare("PRAGMA table_info(TypesComptes)").all() as { name: string }[];
        const hasMaxOrdonnances = typeComptesColumns.some(c => c.name === 'max_ordonnances');
        const hasMaxRappels = typeComptesColumns.some(c => c.name === 'max_rappels');

        if (!hasMaxOrdonnances) {
            console.log("Adding max_ordonnances column to TypesComptes...");
            db.exec("ALTER TABLE TypesComptes ADD COLUMN max_ordonnances INT DEFAULT -1");
        }
        if (!hasMaxRappels) {
            console.log("Adding max_rappels column to TypesComptes...");
            db.exec("ALTER TABLE TypesComptes ADD COLUMN max_rappels INT DEFAULT -1");
        }

        // Create CategoriesAge table
        db.exec(`
                CREATE TABLE IF NOT EXISTS CategoriesAge (
                    id_categorie INTEGER PRIMARY KEY AUTOINCREMENT,
                    nom_categorie TEXT NOT NULL UNIQUE,
                    description TEXT,
                    considere_poids BOOLEAN DEFAULT 0
                )
            `);

        // Migration: Add considere_poids column if it doesn't exist
        const catColumns = db.prepare("PRAGMA table_info(CategoriesAge)").all() as { name: string }[];
        const hasConsiderePoids = catColumns.some(c => c.name === 'considere_poids');
        if (!hasConsiderePoids) {
            console.log("Adding considere_poids column to CategoriesAge...");
            db.exec("ALTER TABLE CategoriesAge ADD COLUMN considere_poids BOOLEAN DEFAULT 0");
        }

        // Migration: Add PIN expiration columns to Utilisateurs
        const userColumns = db.prepare("PRAGMA table_info(Utilisateurs)").all() as { name: string }[];
        const hasPinExpiresAt = userColumns.some(c => c.name === 'pin_expires_at');
        const hasPinUpdatedAt = userColumns.some(c => c.name === 'pin_updated_at');

        if (!hasPinExpiresAt) {
            console.log("Adding pin_expires_at column to Utilisateurs...");
            db.exec("ALTER TABLE Utilisateurs ADD COLUMN pin_expires_at DATETIME");
        }
        if (!hasPinUpdatedAt) {
            console.log("Adding pin_updated_at column to Utilisateurs...");
            db.exec("ALTER TABLE Utilisateurs ADD COLUMN pin_updated_at DATETIME");
        }

        const hasIdCreateur = userColumns.some(c => c.name === 'id_createur');
        const hasEstValide = userColumns.some(c => c.name === 'est_valide');

        if (!hasIdCreateur) {
            console.log("Adding id_createur column to Utilisateurs...");
            db.exec("ALTER TABLE Utilisateurs ADD COLUMN id_createur INTEGER");
        }
        if (!hasEstValide) {
            console.log("Adding est_valide column to Utilisateurs...");
            db.exec("ALTER TABLE Utilisateurs ADD COLUMN est_valide BOOLEAN DEFAULT TRUE");
        }

        const hasCreeLe = userColumns.some(c => c.name === 'cree_le');
        const hasMisAJourLe = userColumns.some(c => c.name === 'mis_a_jour_le');
        if (!hasCreeLe) {
            console.log("Adding cree_le column to Utilisateurs...");
            db.exec("ALTER TABLE Utilisateurs ADD COLUMN cree_le DATETIME DEFAULT CURRENT_TIMESTAMP");
        }
        if (!hasMisAJourLe) {
            console.log("Adding mis_a_jour_le column to Utilisateurs...");
            db.exec("ALTER TABLE Utilisateurs ADD COLUMN mis_a_jour_le DATETIME DEFAULT CURRENT_TIMESTAMP");
        }

        const catAgeCount = db.prepare("SELECT COUNT(*) as count FROM CategoriesAge").get() as { count: number };
        if (catAgeCount.count === 0) {
            console.log("Adding default age categories...");
            db.prepare("INSERT INTO CategoriesAge (nom_categorie, description, considere_poids) VALUES (?, ?, ?)").run('bébé', '0 à 2 ans', 1);
            db.prepare("INSERT INTO CategoriesAge (nom_categorie, description, considere_poids) VALUES (?, ?, ?)").run('enfant', '2 à 12 ans', 1);
            db.prepare("INSERT INTO CategoriesAge (nom_categorie, description, considere_poids) VALUES (?, ?, ?)").run('adulte', 'Plus de 12 ans', 0);
        }

        // Create PosologieDefautMedicaments table if not exists (Updated for dynamic categories)
        db.exec(`
                CREATE TABLE IF NOT EXISTS PosologieDefautMedicaments (
                    id_posologie INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_medicament INT NOT NULL,
                    categorie_age TEXT,
                    dose_recommandee DECIMAL(10,2),
                    id_unite INT,
                    FOREIGN KEY (id_medicament) REFERENCES Medicaments(id_medicament) ON DELETE CASCADE,
                    FOREIGN KEY (id_unite) REFERENCES Unites(id_unite)
                )
            `);


        // Migration: allow dynamic age categories in PosologieDefautMedicaments
        const posologyTable = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='PosologieDefautMedicaments'").get() as { sql?: string } | undefined;
        const hasCategorieAgeCheck = posologyTable?.sql?.includes("CHECK(categorie_age IN") || false;
        if (hasCategorieAgeCheck) {
            console.log("Migrating PosologieDefautMedicaments to remove fixed categorie_age CHECK constraint...");
            db.exec(`
                    BEGIN;
                    CREATE TABLE IF NOT EXISTS PosologieDefautMedicaments_new (
                        id_posologie INTEGER PRIMARY KEY AUTOINCREMENT,
                        id_medicament INT NOT NULL,
                        categorie_age TEXT,
                        dose_recommandee DECIMAL(10,2),
                        id_unite INT,
                        FOREIGN KEY (id_medicament) REFERENCES Medicaments(id_medicament) ON DELETE CASCADE,
                        FOREIGN KEY (id_unite) REFERENCES Unites(id_unite)
                    );
                    INSERT INTO PosologieDefautMedicaments_new (id_posologie, id_medicament, categorie_age, dose_recommandee, id_unite)
                    SELECT id_posologie, id_medicament, categorie_age, dose_recommandee, id_unite
                    FROM PosologieDefautMedicaments;
                    DROP TABLE PosologieDefautMedicaments;
                    ALTER TABLE PosologieDefautMedicaments_new RENAME TO PosologieDefautMedicaments;
                    COMMIT;
                `);
        }

        // Migration: allow dynamic age categories and cleanup Ordonnances
        const ordonnanceSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='Ordonnances'").get() as { sql?: string } | undefined;
        const hasOrdonnanceCategorieAgeCheck = ordonnanceSchema?.sql?.includes("CHECK(categorie_age IN") || false;
        const hasAgePatient = ordonnanceSchema?.sql?.includes("age_patient") || false;

        if (hasOrdonnanceCategorieAgeCheck || hasAgePatient) {
            console.log("Migrating Ordonnances to remove fixed categorie_age CHECK constraint and cleanup columns...");
            db.exec(`
                    BEGIN;
                    CREATE TABLE IF NOT EXISTS Ordonnances_new (
                        id_ordonnance INTEGER PRIMARY KEY AUTOINCREMENT,
                        id_utilisateur INT NOT NULL,
                        titre VARCHAR(255),
                        nom_patient VARCHAR(255),
                        categorie_age TEXT DEFAULT 'adulte',
                        poids_patient DECIMAL(5,2),
                        date_ordonnance DATE DEFAULT CURRENT_DATE,
                        date_debut DATE,
                        est_active BOOLEAN DEFAULT TRUE,
                        cree_le DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (id_utilisateur) REFERENCES Utilisateurs(id_utilisateur) ON DELETE CASCADE
                    );
                    INSERT INTO Ordonnances_new (id_ordonnance, id_utilisateur, titre, nom_patient, categorie_age, poids_patient, date_ordonnance, est_active, cree_le)
                    SELECT id_ordonnance, id_utilisateur, titre, nom_patient, categorie_age, poids_patient, date_ordonnance, est_active, cree_le
                    FROM Ordonnances;
                    DROP TABLE Ordonnances;
                    ALTER TABLE Ordonnances_new RENAME TO Ordonnances;
                    COMMIT;
                `);
        }

        // Migration for Phase 2: date_debut
        const ordonnanceCols = db.prepare("PRAGMA table_info(Ordonnances)").all() as { name: string }[];
        if (!ordonnanceCols.some(c => c.name === 'date_debut')) {
            console.log("Adding date_debut column to Ordonnances...");
            db.exec("ALTER TABLE Ordonnances ADD COLUMN date_debut DATE");
            // Initialize date_debut with date_ordonnance for existing records
            db.exec("UPDATE Ordonnances SET date_debut = date_ordonnance WHERE date_debut IS NULL");
        }

        // Migration: ensure TypesComptes has correct column names and no duplicates
        const tcCols = db.prepare("PRAGMA table_info(TypesComptes)").all() as { name: string }[];
        const hasOldOrdonnances = tcCols.some(c => c.name === 'max_ordonnances_actives');
        const hasNewOrdonnances = tcCols.some(c => c.name === 'max_ordonnances');
        const hasOldRappels = tcCols.some(c => c.name === 'limite_notifications');
        const hasNewRappels = tcCols.some(c => c.name === 'max_rappels');

        if (hasOldOrdonnances && !hasNewOrdonnances) {
            console.log("Renaming max_ordonnances_actives to max_ordonnances...");
            db.exec("ALTER TABLE TypesComptes RENAME COLUMN max_ordonnances_actives TO max_ordonnances");
        } else if (hasOldOrdonnances && hasNewOrdonnances) {
            console.log("Cleaning up redundant max_ordonnances_actives...");
            try { db.exec("ALTER TABLE TypesComptes DROP COLUMN max_ordonnances_actives"); } catch(e) {}
        } else if (!hasNewOrdonnances) {
            console.log("Adding max_ordonnances column to TypesComptes...");
            db.exec("ALTER TABLE TypesComptes ADD COLUMN max_ordonnances INT DEFAULT -1");
        }

        if (hasOldRappels && !hasNewRappels) {
            console.log("Renaming limite_notifications to max_rappels...");
            db.exec("ALTER TABLE TypesComptes RENAME COLUMN limite_notifications TO max_rappels");
        } else if (hasOldRappels && hasNewRappels) {
            console.log("Cleaning up redundant limite_notifications...");
            try { db.exec("ALTER TABLE TypesComptes DROP COLUMN limite_notifications"); } catch(e) {}
        } else if (!hasNewRappels) {
            console.log("Adding max_rappels column to TypesComptes...");
            db.exec("ALTER TABLE TypesComptes ADD COLUMN max_rappels INT DEFAULT -1");
        }

        // Ensure default account types exist with consistent values
        const typesToEnsure = [
            { id: 1, name: 'Standard', desc: 'Compte Standard gratuit', ordo: 1, rappels: 3, pay: 0, pharmacies: null },
            { id: 2, name: 'Professionnel', desc: 'Compte Pro / Pharmacien (Gestion de pharmacies et ordonnances)', ordo: -1, rappels: -1, pay: 1, pharmacies: 10 },
            { id: 3, name: 'Commercial', desc: 'Peut créer et valider des clients avec ordonnance', ordo: -1, rappels: -1, pay: 0, pharmacies: null },
            { id: 4, name: 'Administrateur', desc: 'Accès complet au système', ordo: -1, rappels: -1, pay: 0, pharmacies: null }
        ];

        for (const t of typesToEnsure) {
            // First, ensure no other ID has the name we want (to avoid UNIQUE conflict)
            db.prepare("UPDATE TypesComptes SET nom_type = nom_type || '_old' WHERE nom_type = ? AND id_type_compte <> ?").run(t.name, t.id);

            db.prepare(`
                INSERT INTO TypesComptes (id_type_compte, nom_type, description, max_ordonnances, max_rappels, necessite_paiement, max_pharmacies)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id_type_compte) DO UPDATE SET
                    nom_type = excluded.nom_type,
                    description = excluded.description,
                    max_ordonnances = excluded.max_ordonnances,
                    max_rappels = excluded.max_rappels,
                    necessite_paiement = excluded.necessite_paiement,
                    max_pharmacies = excluded.max_pharmacies
            `).run(t.id, t.name, t.desc, t.ordo, t.rappels, t.pay, t.pharmacies);
        }

        // Create test users for Professional and Pharmacist accounts
        const getAdminTypeId = () => db.prepare("SELECT id_type_compte FROM TypesComptes WHERE nom_type = 'Administrateur'").get() as { id_type_compte: number };
        const adminPhone = process.env.ADMIN_PHONE || 'admin';
        const adminPin = process.env.ADMIN_PIN || 'admin';
        const adminUser = db.prepare("SELECT id_utilisateur FROM Utilisateurs WHERE numero_telephone = ?").get(adminPhone);

        if (!adminUser) {
            console.log("Creating default admin user (admin/admin)...");
            const adminTypeId = getAdminTypeId().id_type_compte;
            const info = db.prepare("INSERT INTO Utilisateurs (numero_telephone, pin_hash, id_type_compte, est_pharmacien) VALUES (?, ?, ?, 1)")
                .run(adminPhone, adminPin, adminTypeId);
            db.prepare("INSERT INTO ProfilsUtilisateurs (id_utilisateur, nom_complet) VALUES (?, ?)")
                .run(info.lastInsertRowid, 'Administrateur Système');
        }

        const commercialUser = db.prepare("SELECT id_utilisateur FROM Utilisateurs WHERE numero_telephone = ?").get('commercial');
        if (!commercialUser) {
            console.log("Creating test commercial user (commercial/1234)...");
            const info = db.prepare("INSERT INTO Utilisateurs (numero_telephone, pin_hash, id_type_compte, est_pharmacien) VALUES (?, ?, ?, 0)")
                .run('commercial', '1234', 3);
            db.prepare("INSERT INTO ProfilsUtilisateurs (id_utilisateur, nom_complet) VALUES (?, ?)")
                .run(info.lastInsertRowid, 'Agent Commercial Test');
        }
        db.exec(`
                CREATE TABLE IF NOT EXISTS UpgradeRequests (
                    id_request INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_utilisateur INTEGER NOT NULL,
                    requested_type TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    motive TEXT,
                    admin_notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    processed_at DATETIME,
                    processed_by INTEGER,
                    FOREIGN KEY (id_utilisateur) REFERENCES Utilisateurs(id_utilisateur) ON DELETE CASCADE,
                    FOREIGN KEY (processed_by) REFERENCES Utilisateurs(id_utilisateur)
                )
            `);

        // Migration: add motive column if missing
        const upgradeReqCols = db.prepare("PRAGMA table_info(UpgradeRequests)").all() as { name: string }[];
        if (!upgradeReqCols.some(c => c.name === 'motive')) {
            console.log("Adding motive column to UpgradeRequests...");
            db.exec("ALTER TABLE UpgradeRequests ADD COLUMN motive TEXT");
        }

        // Migrate UpgradeRequests to remove restricted check constraints to allow 'Commercial'
        const upgradeReqSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='UpgradeRequests'").get() as { sql?: string } | undefined;
        if (upgradeReqSchema?.sql?.includes("CHECK(requested_type IN")) {
            console.log("Migrating UpgradeRequests to relax requested_type constraints...");
            db.exec(`
                BEGIN;
                CREATE TABLE UpgradeRequests_new (
                    id_request INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_utilisateur INTEGER NOT NULL,
                    requested_type TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    motive TEXT,
                    admin_notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    processed_at DATETIME,
                    processed_by INTEGER,
                    FOREIGN KEY (id_utilisateur) REFERENCES Utilisateurs(id_utilisateur) ON DELETE CASCADE,
                    FOREIGN KEY (processed_by) REFERENCES Utilisateurs(id_utilisateur)
                );
                INSERT INTO UpgradeRequests_new (id_request, id_utilisateur, requested_type, status, motive, admin_notes, created_at, processed_at, processed_by)
                SELECT id_request, id_utilisateur, requested_type, status, motive, admin_notes, created_at, processed_at, processed_by
                FROM UpgradeRequests;
                DROP TABLE UpgradeRequests;
                ALTER TABLE UpgradeRequests_new RENAME TO UpgradeRequests;
                COMMIT;
            `);
        }

        // Create FraisComptesProfessionnels table if missing
        db.exec(`
                CREATE TABLE IF NOT EXISTS FraisComptesProfessionnels (
                    id_frais INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_type_compte INTEGER UNIQUE NOT NULL,
                    montant DECIMAL(10,2) NOT NULL,
                    devise VARCHAR(10) DEFAULT 'FCFA',
                    FOREIGN KEY (id_type_compte) REFERENCES TypesComptes(id_type_compte) ON DELETE CASCADE
                )
            `);

        // Create Paiements table for payment tracking
        db.exec(`
                CREATE TABLE IF NOT EXISTS Paiements (
                    id_paiement INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_utilisateur INTEGER NOT NULL,
                    montant DECIMAL(10,2) NOT NULL,
                    devise VARCHAR(10) DEFAULT 'FCFA',
                    statut VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(statut IN ('pending', 'complete', 'failed', 'refunded')),
                    date_paiement DATETIME DEFAULT CURRENT_TIMESTAMP,
                    reference VARCHAR(100),
                    FOREIGN KEY (id_utilisateur) REFERENCES Utilisateurs(id_utilisateur) ON DELETE CASCADE
                )
            `);

        // Migration for Reminder Worker Reliability (tentatives_rappel and dernier_essai)
        const cpColumns = db.prepare("PRAGMA table_info(CalendrierPrises)").all() as { name: string }[];
        if (!cpColumns.some(c => c.name === 'tentatives_rappel')) {
            console.log("Adding tentatives_rappel column to CalendrierPrises...");
            db.exec("ALTER TABLE CalendrierPrises ADD COLUMN tentatives_rappel INTEGER DEFAULT 0");
        }
        if (!cpColumns.some(c => c.name === 'dernier_essai')) {
            console.log("Adding dernier_essai column to CalendrierPrises...");
            db.exec("ALTER TABLE CalendrierPrises ADD COLUMN dernier_essai DATETIME");
        }

        // Migration: Ensure NotificationJobs has ON DELETE CASCADE
        const njSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='NotificationJobs'").get() as { sql?: string } | undefined;
        if (njSchema?.sql && !njSchema.sql.includes("ON DELETE CASCADE")) {
            console.log("Migrating NotificationJobs to add ON DELETE CASCADE...");
            db.exec("PRAGMA foreign_keys = OFF");
            db.exec(`
                BEGIN;
                CREATE TABLE NotificationJobs_new (
                    id_job INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_utilisateur INT,
                    id_calendrier_prise INT,
                    channel VARCHAR(20) NOT NULL,
                    message TEXT NOT NULL,
                    contact_value VARCHAR(255) NOT NULL,
                    scheduled_at DATETIME NOT NULL,
                    status TEXT DEFAULT 'pending',
                    retry_count INT DEFAULT 0,
                    max_retries INT DEFAULT 3,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    processed_at DATETIME,
                    FOREIGN KEY (id_utilisateur) REFERENCES Utilisateurs(id_utilisateur) ON DELETE CASCADE,
                    FOREIGN KEY (id_calendrier_prise) REFERENCES CalendrierPrises(id_calendrier_prise) ON DELETE CASCADE
                );
                INSERT INTO NotificationJobs_new SELECT * FROM NotificationJobs;
                DROP TABLE NotificationJobs;
                ALTER TABLE NotificationJobs_new RENAME TO NotificationJobs;
                COMMIT;
            `);
            db.exec("PRAGMA foreign_keys = ON");
        }

        // PharmaciesGarde table (pharmacies de garde scrapées)
        db.exec(`
            CREATE TABLE IF NOT EXISTS PharmaciesGarde (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nom TEXT NOT NULL,
                adresse TEXT,
                telephone TEXT,
                statut TEXT DEFAULT 'ouverte',
                region TEXT NOT NULL,
                ville TEXT,
                latitude REAL,
                longitude REAL,
                source_url TEXT,
                mis_a_jour_le DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(nom, telephone, region)
            )
        `);

        // Migrate old PharmaciesGarde schema if missing columns
        try {
            const gardeCols = db.prepare("PRAGMA table_info(PharmaciesGarde)").all() as { name: string }[];
            if (gardeCols.length > 0) {
                if (!gardeCols.some(c => c.name === 'ville')) {
                    db.exec("ALTER TABLE PharmaciesGarde ADD COLUMN ville TEXT");
                }
                if (!gardeCols.some(c => c.name === 'latitude')) {
                    db.exec("ALTER TABLE PharmaciesGarde ADD COLUMN latitude REAL");
                }
                if (!gardeCols.some(c => c.name === 'longitude')) {
                    db.exec("ALTER TABLE PharmaciesGarde ADD COLUMN longitude REAL");
                }
                if (!gardeCols.some(c => c.name === 'source_url')) {
                    db.exec("ALTER TABLE PharmaciesGarde ADD COLUMN source_url TEXT");
                }
            }
        } catch {
            // table may not exist yet on first run
        }
        const nlSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='NotificationLogs'").get() as { sql?: string } | undefined;
        if (nlSchema?.sql && !nlSchema.sql.includes("ON DELETE CASCADE")) {
            console.log("Migrating NotificationLogs to add ON DELETE CASCADE...");
            db.exec("PRAGMA foreign_keys = OFF");
            db.exec(`
                BEGIN;
                CREATE TABLE NotificationLogs_new (
                    id_log INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_job INT,
                    provider VARCHAR(50),
                    channel VARCHAR(20),
                    to_contact VARCHAR(255),
                    message TEXT,
                    status TEXT,
                    error_message TEXT,
                    provider_message_id VARCHAR(255),
                    cost DECIMAL(5, 3),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (id_job) REFERENCES NotificationJobs(id_job) ON DELETE CASCADE
                );
                INSERT INTO NotificationLogs_new SELECT * FROM NotificationLogs;
                DROP TABLE NotificationLogs;
                ALTER TABLE NotificationLogs_new RENAME TO NotificationLogs;
                COMMIT;
            `);
            db.exec("PRAGMA foreign_keys = ON");
        }

        // Notifications in-app feed
        db.exec(`
            CREATE TABLE IF NOT EXISTS Notifications (
                id_notification INTEGER PRIMARY KEY AUTOINCREMENT,
                id_utilisateur INTEGER NOT NULL,
                titre TEXT NOT NULL,
                contenu TEXT,
                type_notif TEXT DEFAULT 'general',
                payload TEXT,
                est_lu INTEGER DEFAULT 0,
                est_pousse INTEGER DEFAULT 0,
                cree_le DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (id_utilisateur) REFERENCES Utilisateurs(id_utilisateur) ON DELETE CASCADE
            )
        `);

        // Device tokens for push (web, android, ios)
        db.exec(`
            CREATE TABLE IF NOT EXISTS DeviceTokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                id_utilisateur INTEGER NOT NULL,
                platform TEXT NOT NULL,
                token TEXT NOT NULL,
                device_label TEXT,
                est_active INTEGER DEFAULT 1,
                cree_le DATETIME DEFAULT CURRENT_TIMESTAMP,
                mis_a_jour_le DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(id_utilisateur, platform, token),
                FOREIGN KEY (id_utilisateur) REFERENCES Utilisateurs(id_utilisateur) ON DELETE CASCADE
            )
        `);

        db.prepare(`
            INSERT OR IGNORE INTO CanauxNotification (id_canal, nom_canal) VALUES (1, 'SMS')
        `).run();
        db.prepare(`
            INSERT OR IGNORE INTO CanauxNotification (id_canal, nom_canal) VALUES (2, 'WhatsApp')
        `).run();
        db.prepare(`
            INSERT OR IGNORE INTO CanauxNotification (id_canal, nom_canal) VALUES (3, 'Appel')
        `).run();
        db.prepare(`
            INSERT OR IGNORE INTO CanauxNotification (id_canal, nom_canal) VALUES (4, 'Push')
        `).run();

        // Unique constraint on notification preferences
        try {
            db.exec(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_prefs_user_channel_contact
                ON PreferencesNotificationUtilisateurs(id_utilisateur, id_canal, valeur_contact)
            `);
        } catch {
            // index may already exist
        }
    } catch (error) {
        console.error("Failed to initialize database:", error);
        throw error;
    }
}
