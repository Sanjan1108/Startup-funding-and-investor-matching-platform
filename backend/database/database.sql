-- ============================================================
-- STARTUP FUNDING & INVESTOR MATCHING PLATFORM
-- MySQL Command Line Client Script
-- ============================================================

DROP DATABASE IF EXISTS startup_funding_platform;
CREATE DATABASE startup_funding_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE startup_funding_platform;

-- Show the database name in the MySQL prompt for screenshots/demo
prompt mysql [startup_funding_platform]> 

-- ============================================================
-- 1. CREATING TABLES (DDL)
-- ============================================================

CREATE TABLE `user` (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(15),
    role ENUM('STARTUP','INVESTOR','ADMIN') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE industry (
    industry_id INT AUTO_INCREMENT PRIMARY KEY,
    industry_name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE startup (
    startup_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    industry_id INT NOT NULL,
    startup_name VARCHAR(150) NOT NULL,
    description TEXT,
    website VARCHAR(255),
    founded_date DATE,
    location VARCHAR(100),
    funding_stage VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_startup_user
        FOREIGN KEY (user_id) REFERENCES `user`(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_startup_industry
        FOREIGN KEY (industry_id) REFERENCES industry(industry_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_startup_user(user_id),
    INDEX idx_startup_industry(industry_id)
) ENGINE=InnoDB;

CREATE TABLE investor (
    investor_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    investor_type VARCHAR(50) NOT NULL,
    firm_name VARCHAR(150),
    description TEXT,
    website VARCHAR(255),
    location VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_investor_user
        FOREIGN KEY (user_id) REFERENCES `user`(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_investor_user(user_id)
) ENGINE=InnoDB;

CREATE TABLE investor_contact (
    contact_id INT AUTO_INCREMENT PRIMARY KEY,
    investor_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    designation VARCHAR(100),
    email VARCHAR(150),
    phone VARCHAR(15),
    is_primary BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_contact_investor
        FOREIGN KEY (investor_id) REFERENCES investor(investor_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE funding_round (
    round_id INT AUTO_INCREMENT PRIMARY KEY,
    startup_id INT NOT NULL,
    round_name VARCHAR(100) NOT NULL,
    round_type ENUM('PRE_SEED','SEED','SERIES_A','SERIES_B','SERIES_C','OTHER') NOT NULL,
    amount_required DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    valuation_expected DECIMAL(15,2),
    status ENUM('OPEN','CLOSED','IN_PROGRESS') DEFAULT 'OPEN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_round_startup
        FOREIGN KEY (startup_id) REFERENCES startup(startup_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_amount_required CHECK (amount_required > 0),
    CONSTRAINT chk_valuation CHECK (
        valuation_expected IS NULL OR valuation_expected > 0
    ),
    INDEX idx_funding_startup(startup_id)
) ENGINE=InnoDB;

CREATE TABLE match_result (
    match_id INT AUTO_INCREMENT PRIMARY KEY,
    startup_id INT NOT NULL,
    investor_id INT NOT NULL,
    match_score DECIMAL(5,2) NOT NULL,
    matched_date DATE NOT NULL,
    status ENUM('PENDING','ACCEPTED','REJECTED') DEFAULT 'PENDING',
    CONSTRAINT fk_match_startup
        FOREIGN KEY (startup_id) REFERENCES startup(startup_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_match_investor
        FOREIGN KEY (investor_id) REFERENCES investor(investor_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_match_score CHECK (match_score >= 0 AND match_score <= 100),
    CONSTRAINT uq_startup_investor UNIQUE (startup_id, investor_id),
    INDEX idx_match_startup(startup_id),
    INDEX idx_match_investor(investor_id),
    INDEX idx_match_score(match_score)
) ENGINE=InnoDB;

CREATE TABLE investment (
    investment_id INT AUTO_INCREMENT PRIMARY KEY,
    round_id INT NOT NULL,
    investor_id INT NOT NULL,
    amount_invested DECIMAL(15,2) NOT NULL,
    equity_percentage DECIMAL(5,2),
    investment_date DATE NOT NULL,
    terms TEXT,
    CONSTRAINT fk_investment_round
        FOREIGN KEY (round_id) REFERENCES funding_round(round_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_investment_investor
        FOREIGN KEY (investor_id) REFERENCES investor(investor_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_investment_amount CHECK (amount_invested > 0),
    CONSTRAINT chk_equity_percentage CHECK (
        equity_percentage IS NULL OR
        (equity_percentage >= 0 AND equity_percentage <= 100)
    ),
    INDEX idx_investment_round(round_id),
    INDEX idx_investment_investor(investor_id)
) ENGINE=InnoDB;

CREATE TABLE meeting (
    meeting_id INT AUTO_INCREMENT PRIMARY KEY,
    startup_id INT NOT NULL,
    investor_id INT NOT NULL,
    meeting_date DATETIME NOT NULL,
    meeting_type VARCHAR(50),
    notes TEXT,
    outcome VARCHAR(255),
    CONSTRAINT fk_meeting_startup
        FOREIGN KEY (startup_id) REFERENCES startup(startup_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_meeting_investor
        FOREIGN KEY (investor_id) REFERENCES investor(investor_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE follow_up (
    followup_id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    followup_date DATE,
    status ENUM('PENDING','COMPLETED','CANCELLED') DEFAULT 'PENDING',
    CONSTRAINT fk_followup_meeting
        FOREIGN KEY (meeting_id) REFERENCES meeting(meeting_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE pitch_deck (
    deck_id INT AUTO_INCREMENT PRIMARY KEY,
    startup_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    CONSTRAINT fk_pitch_startup
        FOREIGN KEY (startup_id) REFERENCES startup(startup_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE negotiation (
    negotiation_id INT AUTO_INCREMENT PRIMARY KEY,
    startup_id INT NOT NULL,
    investor_id INT NOT NULL,
    round_id INT NOT NULL,
    proposed_by ENUM('STARTUP','INVESTOR') NOT NULL,
    amount_offered DECIMAL(15,2) NOT NULL,
    equity_percentage DECIMAL(5,2) NOT NULL,
    valuation_expected DECIMAL(15,2),
    status ENUM('PROPOSED','COUNTER_OFFERED','ACCEPTED','REJECTED') DEFAULT 'PROPOSED',
    terms TEXT,
    round_number INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_negotiation_startup
        FOREIGN KEY (startup_id) REFERENCES startup(startup_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_negotiation_investor
        FOREIGN KEY (investor_id) REFERENCES investor(investor_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_negotiation_round
        FOREIGN KEY (round_id) REFERENCES funding_round(round_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_negotiation_amount CHECK (amount_offered > 0),
    CONSTRAINT chk_negotiation_equity CHECK (
        equity_percentage >= 0 AND equity_percentage <= 100
    ),
    INDEX idx_negotiation_startup(startup_id),
    INDEX idx_negotiation_investor(investor_id),
    INDEX idx_negotiation_round(round_id),
    INDEX idx_negotiation_status(status)
) ENGINE=InnoDB;

CREATE TABLE negotiation_audit (
    audit_id INT AUTO_INCREMENT PRIMARY KEY,
    negotiation_id INT NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    old_amount DECIMAL(15,2),
    new_amount DECIMAL(15,2),
    old_equity DECIMAL(5,2),
    new_equity DECIMAL(5,2),
    round_number INT,
    action_type VARCHAR(30),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_negotiation
        FOREIGN KEY (negotiation_id) REFERENCES negotiation(negotiation_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_audit_negotiation(negotiation_id)
) ENGINE=InnoDB;

-- ============================================================
-- 2. ALTER TABLE / INDEXES
-- ============================================================

ALTER TABLE startup
ADD CONSTRAINT chk_startup_name CHECK (CHAR_LENGTH(startup_name) >= 2);

CREATE INDEX idx_funding_status ON funding_round(status);
CREATE INDEX idx_meeting_date ON meeting(meeting_date);

SHOW TABLES;

-- ============================================================
-- 3. INSERTING VALUES (DML)
-- ============================================================

INSERT INTO `user` (name,email,password_hash,phone,role) VALUES
('Sanjan M','sanjan@gmail.com','hash001','9876500001','STARTUP'),
('Rahul Kumar','rahul@gmail.com','hash002','9876500002','STARTUP'),
('Ananya Rao','ananya@gmail.com','hash003','9876500003','STARTUP'),
('Arjun Shah','arjun@gmail.com','hash004','9876500004','STARTUP'),
('Priya Nair','priya@gmail.com','hash005','9876500005','STARTUP'),
('Rohan Mehta','rohan@gmail.com','hash006','9876500006','INVESTOR'),
('Karan Gupta','karan@gmail.com','hash007','9876500007','INVESTOR'),
('Neha Sharma','neha@gmail.com','hash008','9876500008','INVESTOR'),
('Vikram Singh','vikram@gmail.com','hash009','9876500009','INVESTOR'),
('Meera Iyer','meera@gmail.com','hash010','9876500010','INVESTOR'),
('Admin User','admin@gmail.com','hash011','9876500011','ADMIN'),
('Investor User','investor2@gmail.com','hash012','9876500012','INVESTOR');

INSERT INTO industry (industry_name) VALUES
('FinTech'),('HealthTech'),('EdTech'),('AgriTech'),
('E-Commerce'),('Artificial Intelligence'),('CleanTech'),('Cybersecurity');

INSERT INTO startup
(user_id,industry_id,startup_name,description,website,founded_date,location,funding_stage)
VALUES
(1,1,'PayNova','Digital payment platform','https://paynova.example.com','2023-01-15','Bangalore','SEED'),
(2,2,'MediTrack','Healthcare monitoring platform','https://meditrack.example.com','2022-06-20','Hyderabad','SERIES_A'),
(3,3,'EduSpark','Online learning platform','https://eduspark.example.com','2024-02-10','Chennai','PRE_SEED'),
(4,4,'AgroSmart','Smart farming solutions','https://agrosmart.example.com','2023-08-05','Mysore','SEED'),
(5,6,'AIBrain','AI automation solutions','https://aibrain.example.com','2022-11-18','Pune','SERIES_A');

INSERT INTO investor
(user_id,investor_type,firm_name,description,website,location)
VALUES
(6,'Angel Investor','Mehta Ventures','Early stage technology investor','https://mehtaventures.example.com','Bangalore'),
(7,'Venture Capital','Gupta Capital','Technology focused VC firm','https://guptacapital.example.com','Mumbai'),
(8,'Angel Investor','Sharma Investments','Healthcare and education investor','https://sharmainvest.example.com','Delhi'),
(9,'Venture Capital','Singh Ventures','Growth stage investor','https://singhventures.example.com','Bangalore'),
(10,'Angel Investor','Iyer Holdings','Startup and technology investor','https://iyerholdings.example.com','Chennai'),
(12,'Venture Capital','FutureFund VC','AI and emerging technology investor','https://futurefund.example.com','Hyderabad');

INSERT INTO investor_contact
(investor_id,name,designation,email,phone,is_primary) VALUES
(1,'Rohan Mehta','Partner','rohan@mehtaventures.com','9000000001',TRUE),
(2,'Karan Gupta','Managing Partner','karan@guptacapital.com','9000000002',TRUE),
(3,'Neha Sharma','Investment Lead','neha@sharmainvest.com','9000000003',TRUE),
(4,'Vikram Singh','Partner','vikram@singhventures.com','9000000004',TRUE),
(5,'Meera Iyer','Founder','meera@iyerholdings.com','9000000005',TRUE),
(6,'Amit Rao','Associate','amit@futurefund.com','9000000006',TRUE);

INSERT INTO funding_round
(startup_id,round_name,round_type,amount_required,currency,valuation_expected,status)
VALUES
(1,'PayNova Seed Round','SEED',5000000,'INR',25000000,'OPEN'),
(2,'MediTrack Series A','SERIES_A',15000000,'INR',75000000,'OPEN'),
(3,'EduSpark Pre-Seed','PRE_SEED',3000000,'INR',12000000,'OPEN'),
(4,'AgroSmart Seed Round','SEED',7000000,'INR',35000000,'IN_PROGRESS'),
(5,'AIBrain Series A','SERIES_A',20000000,'INR',100000000,'OPEN');

INSERT INTO match_result
(startup_id,investor_id,match_score,matched_date,status) VALUES
(1,1,92.50,'2026-09-01','ACCEPTED'),
(1,2,85.00,'2026-09-02','PENDING'),
(1,4,78.50,'2026-09-03','PENDING'),
(2,3,94.00,'2026-09-01','ACCEPTED'),
(2,4,88.50,'2026-09-02','PENDING'),
(3,3,81.00,'2026-09-04','PENDING'),
(3,5,89.50,'2026-09-05','ACCEPTED'),
(4,1,76.00,'2026-09-06','PENDING'),
(4,2,82.00,'2026-09-06','PENDING'),
(5,2,95.00,'2026-09-07','ACCEPTED'),
(5,4,91.50,'2026-09-07','PENDING'),
(5,6,96.00,'2026-09-08','ACCEPTED');

INSERT INTO investment
(round_id,investor_id,amount_invested,equity_percentage,investment_date,terms)
VALUES
(1,1,2000000,8.00,'2026-09-10','Seed investment'),
(1,2,1500000,6.00,'2026-09-11','Seed investment'),
(2,3,5000000,7.00,'2026-09-12','Series A investment'),
(2,4,4000000,5.00,'2026-09-13','Series A investment'),
(3,5,1500000,10.00,'2026-09-14','Pre-seed investment'),
(4,1,2500000,7.00,'2026-09-15','AgriTech investment'),
(5,2,8000000,8.00,'2026-09-16','AI investment'),
(5,4,5000000,5.00,'2026-09-17','AI investment');

INSERT INTO meeting
(startup_id,investor_id,meeting_date,meeting_type,notes,outcome)
VALUES
(1,1,'2026-09-10 10:00:00','Online','Discussed funding requirements','Positive'),
(1,2,'2026-09-11 14:00:00','Online','Discussed market expansion','Follow-up required'),
(2,3,'2026-09-12 11:00:00','In-Person','Discussed healthcare solution','Investment interest'),
(3,5,'2026-09-14 15:00:00','Online','Discussed education platform','Positive'),
(4,1,'2026-09-15 12:00:00','Online','Discussed agriculture technology','Follow-up required'),
(5,4,'2026-09-16 16:00:00','In-Person','Discussed AI technology','Investment interest');

INSERT INTO follow_up
(meeting_id,title,description,followup_date,status)
VALUES
(1,'Send Financial Report','Startup to send financial projections','2026-09-18','COMPLETED'),
(2,'Schedule Second Meeting','Arrange another investor discussion','2026-09-20','PENDING'),
(3,'Share Product Demo','Send healthcare product demonstration','2026-09-19','COMPLETED'),
(4,'Send Pitch Deck','Send updated pitch deck','2026-09-21','PENDING'),
(5,'Discuss Valuation','Continue valuation discussion','2026-09-22','PENDING'),
(6,'Investment Terms','Finalize investment terms','2026-09-23','PENDING');

INSERT INTO pitch_deck
(startup_id,title,file_url,description)
VALUES
(1,'PayNova Investor Deck','https://example.com/paynova.pdf','Seed funding pitch deck'),
(2,'MediTrack Investor Deck','https://example.com/meditrack.pdf','Series A pitch deck'),
(3,'EduSpark Investor Deck','https://example.com/eduspark.pdf','Pre-seed pitch deck'),
(4,'AgroSmart Investor Deck','https://example.com/agrosmart.pdf','Agritech funding deck'),
(5,'AIBrain Investor Deck','https://example.com/aibrain.pdf','AI startup pitch deck');

INSERT INTO negotiation
(startup_id,investor_id,round_id,proposed_by,amount_offered,equity_percentage,valuation_expected,status,terms,round_number)
VALUES
(1,1,1,'INVESTOR',2000000,8.00,25000000,'ACCEPTED','Seed funding with quarterly advisory review',2),
(1,2,1,'STARTUP',2500000,7.00,35000000,'COUNTER_OFFERED','Counter-proposal sent with board observer rights',2),
(2,3,2,'INVESTOR',5000000,7.00,71400000,'ACCEPTED','Series A lead investor terms with 1 board seat',1),
(3,5,3,'INVESTOR',1500000,10.00,15000000,'PROPOSED','Pre-seed incubator funding term sheet',1),
(4,1,4,'STARTUP',3000000,9.00,33333333,'REJECTED','Valuation gap too high between parties',3);

-- ============================================================
-- 4. BASIC SELECT / JOINS / GROUPING
-- ============================================================

SELECT * FROM startup;
SELECT * FROM investor;
SELECT * FROM funding_round;
SELECT * FROM match_result;
SELECT * FROM investment;

SELECT s.startup_name, i.industry_name
FROM startup s
JOIN industry i ON s.industry_id=i.industry_id;

SELECT s.startup_name, fr.round_name, fr.round_type,
       fr.amount_required, fr.status
FROM startup s
JOIN funding_round fr ON s.startup_id=fr.startup_id;

SELECT s.startup_name, i.firm_name, m.match_score, m.status
FROM match_result m
JOIN startup s ON m.startup_id=s.startup_id
JOIN investor i ON m.investor_id=i.investor_id
ORDER BY m.match_score DESC;

SELECT s.startup_name, i.firm_name, inv.amount_invested,
       inv.equity_percentage, inv.investment_date
FROM investment inv
JOIN funding_round fr ON inv.round_id=fr.round_id
JOIN startup s ON fr.startup_id=s.startup_id
JOIN investor i ON inv.investor_id=i.investor_id;

SELECT s.startup_name, SUM(inv.amount_invested) AS total_investment
FROM startup s
JOIN funding_round fr ON s.startup_id=fr.startup_id
JOIN investment inv ON fr.round_id=inv.round_id
GROUP BY s.startup_id,s.startup_name;

SELECT s.startup_name, COUNT(m.investor_id) AS number_of_investors
FROM startup s
LEFT JOIN match_result m ON s.startup_id=m.startup_id
GROUP BY s.startup_id,s.startup_name;

SELECT s.startup_name, SUM(inv.amount_invested) AS total_investment
FROM startup s
JOIN funding_round fr ON s.startup_id=fr.startup_id
JOIN investment inv ON fr.round_id=inv.round_id
GROUP BY s.startup_id,s.startup_name
HAVING SUM(inv.amount_invested) > 5000000;

SELECT COUNT(*) AS total_investments,
       SUM(amount_invested) AS total_amount,
       AVG(amount_invested) AS average_investment,
       MAX(amount_invested) AS highest_investment,
       MIN(amount_invested) AS lowest_investment
FROM investment;

-- ============================================================
-- 5. NESTED / SUBQUERIES
-- ============================================================

SELECT startup_name
FROM startup
WHERE startup_id IN (
    SELECT startup_id
    FROM funding_round
    WHERE amount_required > (
        SELECT AVG(amount_required) FROM funding_round
    )
);

SELECT s.startup_name, i.firm_name, m.match_score
FROM match_result m
JOIN startup s ON m.startup_id=s.startup_id
JOIN investor i ON m.investor_id=i.investor_id
WHERE m.match_score=(
    SELECT MAX(m2.match_score)
    FROM match_result m2
    WHERE m2.startup_id=m.startup_id
);

SELECT i.firm_name
FROM investor i
WHERE i.investor_id IN (
    SELECT investor_id
    FROM investment
    GROUP BY investor_id
    HAVING SUM(amount_invested) > (
        SELECT AVG(total_invested)
        FROM (
            SELECT SUM(amount_invested) AS total_invested
            FROM investment
            GROUP BY investor_id
        ) x
    )
);

-- ============================================================
-- 6. CORRELATED QUERIES
-- ============================================================

SELECT fr.round_id, fr.startup_id, fr.round_name, fr.amount_required
FROM funding_round fr
WHERE fr.amount_required=(
    SELECT MAX(fr2.amount_required)
    FROM funding_round fr2
    WHERE fr2.startup_id=fr.startup_id
);

SELECT m.match_id, m.startup_id, m.investor_id,
       m.match_score, m.matched_date
FROM match_result m
WHERE m.match_score=(
    SELECT MAX(m2.match_score)
    FROM match_result m2
    WHERE m2.investor_id=m.investor_id
);

-- ============================================================
-- 7. UPDATE / DELETE
-- ============================================================

UPDATE match_result
SET status='ACCEPTED'
WHERE match_id=2;

SELECT * FROM match_result WHERE match_id=2;

-- Demonstration DELETE (safe sample follow-up)
DELETE FROM follow_up
WHERE followup_id=6;

SELECT * FROM follow_up;

-- ============================================================
-- 8. VIEW
-- ============================================================

CREATE OR REPLACE VIEW startup_funding_summary AS
SELECT s.startup_id,
       s.startup_name,
       COUNT(DISTINCT fr.round_id) AS total_funding_rounds,
       COALESCE(SUM(inv.amount_invested),0) AS total_amount_invested
FROM startup s
LEFT JOIN funding_round fr ON s.startup_id=fr.startup_id
LEFT JOIN investment inv ON fr.round_id=inv.round_id
GROUP BY s.startup_id,s.startup_name;

SELECT * FROM startup_funding_summary;

CREATE OR REPLACE VIEW negotiation_summary AS
SELECT n.negotiation_id,
       s.startup_name,
       i.firm_name,
       fr.round_name,
       n.proposed_by,
       n.amount_offered,
       n.equity_percentage,
       CASE
           WHEN n.equity_percentage > 0 THEN ROUND((n.amount_offered / (n.equity_percentage / 100)), 2)
           ELSE NULL
       END AS implied_valuation,
       n.status,
       n.round_number,
       n.updated_at
FROM negotiation n
JOIN startup s ON n.startup_id = s.startup_id
JOIN investor i ON n.investor_id = i.investor_id
JOIN funding_round fr ON n.round_id = fr.round_id;

SELECT * FROM negotiation_summary;

-- ============================================================
-- 9. FUNCTIONS
-- ============================================================

DELIMITER //

CREATE FUNCTION CountStartupMatches(p_startup_id INT)
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE total INT;
    SELECT COUNT(*) INTO total
    FROM match_result
    WHERE startup_id=p_startup_id;
    RETURN total;
END//

CREATE FUNCTION TotalStartupInvestment(p_startup_id INT)
RETURNS DECIMAL(15,2)
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE total DECIMAL(15,2);
    SELECT COALESCE(SUM(inv.amount_invested),0)
    INTO total
    FROM investment inv
    JOIN funding_round fr ON inv.round_id=fr.round_id
    WHERE fr.startup_id=p_startup_id;
    RETURN total;
END//

DELIMITER ;

SELECT startup_id, startup_name,
       CountStartupMatches(startup_id) AS match_count
FROM startup;

SELECT startup_id, startup_name,
       TotalStartupInvestment(startup_id) AS total_investment
FROM startup;

-- ============================================================
-- 10. STORED PROCEDURE
-- ============================================================

DELIMITER //

CREATE PROCEDURE GetStartupInvestors(IN p_startup_id INT)
BEGIN
    SELECT i.investor_id,
           i.firm_name,
           i.investor_type,
           m.match_score,
           m.status
    FROM match_result m
    JOIN investor i ON m.investor_id=i.investor_id
    WHERE m.startup_id=p_startup_id
    ORDER BY m.match_score DESC;
END//

DELIMITER ;

CALL GetStartupInvestors(1);

DELIMITER //

CREATE PROCEDURE AcceptNegotiationAndCreateInvestment(
    IN p_negotiation_id INT,
    IN p_investment_date DATE
)
BEGIN
    DECLARE v_round_id INT;
    DECLARE v_investor_id INT;
    DECLARE v_amount DECIMAL(15,2);
    DECLARE v_equity DECIMAL(5,2);
    DECLARE v_terms TEXT;
    DECLARE v_status VARCHAR(20);

    SELECT round_id, investor_id, amount_offered, equity_percentage, terms, status
    INTO v_round_id, v_investor_id, v_amount, v_equity, v_terms, v_status
    FROM negotiation
    WHERE negotiation_id = p_negotiation_id;

    IF v_status = 'ACCEPTED' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Negotiation has already been accepted';
    ELSEIF v_status = 'REJECTED' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot accept a rejected negotiation';
    END IF;

    START TRANSACTION;
        UPDATE negotiation
        SET status = 'ACCEPTED'
        WHERE negotiation_id = p_negotiation_id;

        INSERT INTO investment (round_id, investor_id, amount_invested, equity_percentage, investment_date, terms)
        VALUES (v_round_id, v_investor_id, v_amount, v_equity, COALESCE(p_investment_date, CURDATE()), CONCAT('Deal finalized via negotiation #', p_negotiation_id, ': ', COALESCE(v_terms, 'Standard terms')));
    COMMIT;
END//

DELIMITER ;

-- ============================================================
-- 11. TRIGGERS
-- ============================================================

DELIMITER //

-- Trigger 1: Validate investment amount, round status, and cumulative equity
DROP TRIGGER IF EXISTS check_investment_amount_and_status//
CREATE TRIGGER check_investment_amount_and_status
BEFORE INSERT ON investment
FOR EACH ROW
BEGIN
    DECLARE v_required_amount DECIMAL(15,2);
    DECLARE v_round_status VARCHAR(20);
    DECLARE v_total_invested DECIMAL(15,2);
    DECLARE v_total_equity DECIMAL(5,2);

    -- 1. Check funding round requirement and status
    SELECT amount_required, status
    INTO v_required_amount, v_round_status
    FROM funding_round
    WHERE round_id = NEW.round_id;

    IF v_round_status = 'CLOSED' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot invest into a closed funding round';
    END IF;

    -- 2. Verify investment does not exceed round requirement
    SELECT COALESCE(SUM(amount_invested), 0)
    INTO v_total_invested
    FROM investment
    WHERE round_id = NEW.round_id;

    IF (v_total_invested + NEW.amount_invested) > v_required_amount THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Total investment would exceed the funding requirement for this round';
    END IF;

    -- 3. Check cumulative equity percentage does not exceed 100%
    IF NEW.equity_percentage IS NOT NULL THEN
        SELECT COALESCE(SUM(equity_percentage), 0)
        INTO v_total_equity
        FROM investment
        WHERE round_id = NEW.round_id;

        IF (v_total_equity + NEW.equity_percentage) > 100.00 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cumulative equity allocated across this round exceeds 100%';
        END IF;
    END IF;
END//

-- Trigger 2: Automatically update funding round status based on capital invested
DROP TRIGGER IF EXISTS update_round_status_after_investment//
CREATE TRIGGER update_round_status_after_investment
AFTER INSERT ON investment
FOR EACH ROW
BEGIN
    DECLARE v_required DECIMAL(15,2);
    DECLARE v_invested DECIMAL(15,2);

    SELECT amount_required INTO v_required
    FROM funding_round
    WHERE round_id = NEW.round_id;

    SELECT COALESCE(SUM(amount_invested), 0) INTO v_invested
    FROM investment
    WHERE round_id = NEW.round_id;

    IF v_invested >= v_required THEN
        UPDATE funding_round
        SET status = 'CLOSED'
        WHERE round_id = NEW.round_id;
    ELSE
        UPDATE funding_round
        SET status = 'IN_PROGRESS'
        WHERE round_id = NEW.round_id AND status = 'OPEN';
    END IF;
END//

-- Trigger 3: Reopen funding round if investment is deleted
DROP TRIGGER IF EXISTS reopen_funding_round_on_investment_delete//
CREATE TRIGGER reopen_funding_round_on_investment_delete
AFTER DELETE ON investment
FOR EACH ROW
BEGIN
    DECLARE v_required DECIMAL(15,2);
    DECLARE v_invested DECIMAL(15,2);

    SELECT amount_required INTO v_required
    FROM funding_round
    WHERE round_id = OLD.round_id;

    SELECT COALESCE(SUM(amount_invested), 0) INTO v_invested
    FROM investment
    WHERE round_id = OLD.round_id;

    IF v_invested < v_required THEN
        UPDATE funding_round
        SET status = IF(v_invested > 0, 'IN_PROGRESS', 'OPEN')
        WHERE round_id = OLD.round_id AND status = 'CLOSED';
    END IF;
END//

-- Trigger 4: Validate negotiation proposal before creation and auto-set implied valuation
DROP TRIGGER IF EXISTS check_negotiation_before_insert//
CREATE TRIGGER check_negotiation_before_insert
BEFORE INSERT ON negotiation
FOR EACH ROW
BEGIN
    DECLARE v_round_amount DECIMAL(15,2);
    DECLARE v_round_status VARCHAR(20);

    SELECT amount_required, status
    INTO v_round_amount, v_round_status
    FROM funding_round
    WHERE round_id = NEW.round_id;

    IF v_round_status = 'CLOSED' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot initiate negotiation on a closed funding round';
    END IF;

    IF NEW.amount_offered <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Offer amount must be greater than zero';
    END IF;

    IF NEW.equity_percentage <= 0 OR NEW.equity_percentage > 100.00 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Equity percentage must be between 0.01% and 100.00%';
    END IF;

    IF v_round_amount IS NOT NULL AND NEW.amount_offered > v_round_amount THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Negotiation offer cannot exceed funding requirement';
    END IF;

    -- Automatically compute implied valuation if not explicitly set
    IF NEW.valuation_expected IS NULL AND NEW.equity_percentage > 0 THEN
        SET NEW.valuation_expected = ROUND(NEW.amount_offered / (NEW.equity_percentage / 100), 2);
    END IF;
END//

-- Trigger 5: Audit log initial negotiation offer on insert
DROP TRIGGER IF EXISTS log_negotiation_audit_after_insert//
CREATE TRIGGER log_negotiation_audit_after_insert
AFTER INSERT ON negotiation
FOR EACH ROW
BEGIN
    INSERT INTO negotiation_audit
    (
        negotiation_id,
        old_status,
        new_status,
        old_amount,
        new_amount,
        old_equity,
        new_equity,
        round_number,
        action_type
    )
    VALUES
    (
        NEW.negotiation_id,
        NULL,
        NEW.status,
        NULL,
        NEW.amount_offered,
        NULL,
        NEW.equity_percentage,
        NEW.round_number,
        'INITIAL_OFFER'
    );
END//

-- Trigger 6: Validate negotiation updates, enforce terminal states and recompute valuation
DROP TRIGGER IF EXISTS check_negotiation_before_update//
CREATE TRIGGER check_negotiation_before_update
BEFORE UPDATE ON negotiation
FOR EACH ROW
BEGIN
    DECLARE v_round_amount DECIMAL(15,2);

    -- Prevent modifying terms of an already finalized/rejected negotiation
    IF OLD.status IN ('ACCEPTED', 'REJECTED') AND NEW.status = OLD.status AND 
       (NEW.amount_offered <> OLD.amount_offered OR NEW.equity_percentage <> OLD.equity_percentage) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot modify terms of an already accepted or rejected negotiation';
    END IF;

    IF NEW.amount_offered <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Counter-offer amount must be greater than zero';
    END IF;

    IF NEW.equity_percentage <= 0 OR NEW.equity_percentage > 100.00 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Equity percentage must be between 0.01% and 100.00%';
    END IF;

    SELECT amount_required INTO v_round_amount
    FROM funding_round
    WHERE round_id = NEW.round_id;

    IF v_round_amount IS NOT NULL AND NEW.amount_offered > v_round_amount THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Counter-offer cannot exceed the round funding requirement';
    END IF;

    -- Keep valuation synchronized
    IF NEW.equity_percentage > 0 THEN
        SET NEW.valuation_expected = ROUND(NEW.amount_offered / (NEW.equity_percentage / 100), 2);
    END IF;
END//

-- Trigger 7: Audit log whenever negotiation terms, status or equity changes
DROP TRIGGER IF EXISTS log_negotiation_audit_after_update//
CREATE TRIGGER log_negotiation_audit_after_update
AFTER UPDATE ON negotiation
FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status OR OLD.amount_offered <> NEW.amount_offered OR OLD.equity_percentage <> NEW.equity_percentage THEN
        INSERT INTO negotiation_audit
        (
            negotiation_id,
            old_status,
            new_status,
            old_amount,
            new_amount,
            old_equity,
            new_equity,
            round_number,
            action_type
        )
        VALUES
        (
            NEW.negotiation_id,
            OLD.status,
            NEW.status,
            OLD.amount_offered,
            NEW.amount_offered,
            OLD.equity_percentage,
            NEW.equity_percentage,
            NEW.round_number,
            CASE
                WHEN NEW.status = 'ACCEPTED' THEN 'DEAL_ACCEPTED'
                WHEN NEW.status = 'REJECTED' THEN 'DEAL_REJECTED'
                WHEN NEW.status = 'COUNTER_OFFERED' THEN 'COUNTER_OFFER'
                ELSE 'TERMS_UPDATED'
            END
        );
    END IF;
END//

-- Trigger 8: Prevent reducing funding requirement below already invested amount
DROP TRIGGER IF EXISTS prevent_closed_round_funding_reduction//
CREATE TRIGGER prevent_closed_round_funding_reduction
BEFORE UPDATE ON funding_round
FOR EACH ROW
BEGIN
    DECLARE v_already_invested DECIMAL(15,2);

    SELECT COALESCE(SUM(amount_invested), 0) INTO v_already_invested
    FROM investment
    WHERE round_id = NEW.round_id;

    IF NEW.amount_required < v_already_invested THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Funding requirement cannot be reduced below the amount already invested';
    END IF;
END//

-- Trigger 9: Validate match score range
DROP TRIGGER IF EXISTS validate_match_result_before_insert//
CREATE TRIGGER validate_match_result_before_insert
BEFORE INSERT ON match_result
FOR EACH ROW
BEGIN
    IF NEW.match_score < 0.00 OR NEW.match_score > 100.00 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Match score must be between 0.00 and 100.00';
    END IF;
END//

DELIMITER ;

-- ============================================================
-- 12. TRANSACTION
-- ============================================================

START TRANSACTION;

UPDATE match_result
SET status='ACCEPTED'
WHERE match_id=3;

INSERT INTO follow_up
(meeting_id,title,description,followup_date,status)
VALUES
(1,'Transaction Test','Temporary transaction demonstration','2026-10-01','PENDING');

COMMIT;

SELECT * FROM match_result WHERE match_id=3;

-- Rollback demonstration
START TRANSACTION;

UPDATE match_result
SET status='REJECTED'
WHERE match_id=4;

ROLLBACK;

SELECT * FROM match_result WHERE match_id=4;

-- ============================================================
-- 13. FINAL CHECKS
-- ============================================================

SHOW TABLES;
SELECT COUNT(*) AS users FROM `user`;
SELECT COUNT(*) AS industries FROM industry;
SELECT COUNT(*) AS startups FROM startup;
SELECT COUNT(*) AS investors FROM investor;
SELECT COUNT(*) AS contacts FROM investor_contact;
SELECT COUNT(*) AS funding_rounds FROM funding_round;
SELECT COUNT(*) AS matches FROM match_result;
SELECT COUNT(*) AS investments FROM investment;
SELECT COUNT(*) AS meetings FROM meeting;
SELECT COUNT(*) AS followups FROM follow_up;
SELECT COUNT(*) AS pitch_decks FROM pitch_deck;
SELECT COUNT(*) AS negotiations FROM negotiation;
SELECT COUNT(*) AS audit_records FROM negotiation_audit;

SHOW TRIGGERS;
SHOW CREATE VIEW startup_funding_summary;
SHOW CREATE VIEW negotiation_summary;
SHOW CREATE PROCEDURE GetStartupInvestors;
SHOW CREATE PROCEDURE AcceptNegotiationAndCreateInvestment;
SHOW INDEX FROM startup;
SHOW INDEX FROM match_result;

-- End of Startup Funding & Investor Matching Platform

-- ============================================================
-- APPLICATION EXTENSION: INVESTOR PREFERENCES
-- Used by the weighted matching engine in the Next.js interface.
-- ============================================================
CREATE TABLE investor_preferences (
    preference_id INT AUTO_INCREMENT PRIMARY KEY,
    investor_id INT NOT NULL UNIQUE,
    industry_id INT NULL,
    preferred_stage VARCHAR(50),
    min_ticket DECIMAL(15,2),
    max_ticket DECIMAL(15,2),
    CONSTRAINT fk_preference_investor FOREIGN KEY (investor_id)
      REFERENCES investor(investor_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_preference_industry FOREIGN KEY (industry_id)
      REFERENCES industry(industry_id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_ticket_range CHECK (min_ticket IS NULL OR max_ticket IS NULL OR min_ticket <= max_ticket)
) ENGINE=InnoDB;

INSERT INTO investor_preferences (investor_id,industry_id,preferred_stage,min_ticket,max_ticket) VALUES
(1,1,'SEED',500000,5000000),
(2,6,'SERIES_A',3000000,20000000),
(3,2,'SERIES_A',1000000,10000000),
(4,NULL,'SERIES_A',5000000,30000000),
(5,3,'PRE_SEED',250000,3000000),
(6,6,'SERIES_A',5000000,50000000);

CREATE INDEX idx_investor_preferences_industry ON investor_preferences(industry_id);
CREATE INDEX idx_investor_preferences_stage ON investor_preferences(preferred_stage);
