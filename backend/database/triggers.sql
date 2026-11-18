-- ============================================================
-- Startup Funding & Investor Matching Platform - Database Triggers
-- Database: startup_funding_platform
-- ============================================================

USE `startup_funding_platform`;

-- Change delimiter so semicolons inside triggers do not end the definition early
DELIMITER //

-- ============================================================
-- TRIGGER 1: check_investment_amount_and_status (BEFORE INSERT ON investment)
-- Enforces:
-- 1. Cannot invest in a closed round
-- 2. Total investments cannot exceed the funding round requirement
-- 3. Total equity allocated across the round cannot exceed 100%
-- ============================================================
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

-- ============================================================
-- TRIGGER 2: update_round_status_after_investment (AFTER INSERT ON investment)
-- Enforces:
-- 1. If total invested reaches or exceeds target, round status -> 'CLOSED'
-- 2. Otherwise if round was 'OPEN', update status -> 'IN_PROGRESS'
-- ============================================================
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

-- ============================================================
-- TRIGGER 3: reopen_funding_round_on_investment_delete (AFTER DELETE ON investment)
-- Enforces:
-- Re-evaluates funding round status if an investment record is removed/cancelled
-- ============================================================
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

-- ============================================================
-- TRIGGER 4: check_negotiation_before_insert (BEFORE INSERT ON negotiation)
-- Enforces:
-- 1. Cannot negotiate on a closed round
-- 2. Offer cannot exceed total funding round requirement
-- 3. Equity offered must be strictly between 0.01% and 100.00%
-- 4. Automatically computes implied valuation if omitted
-- ============================================================
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

-- ============================================================
-- TRIGGER 5: log_negotiation_audit_after_insert (AFTER INSERT ON negotiation)
-- Enforces:
-- Automatically records initial term sheet offer in negotiation_audit table
-- ============================================================
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

-- ============================================================
-- TRIGGER 6: check_negotiation_before_update (BEFORE UPDATE ON negotiation)
-- Enforces:
-- 1. Cannot alter terms of already finalized negotiations ('ACCEPTED' / 'REJECTED')
-- 2. Counter-offer cannot exceed round funding requirement
-- 3. Equity percentage must remain within 0.01% and 100.00%
-- 4. Keeps implied valuation synchronized with offer/equity
-- ============================================================
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

-- ============================================================
-- TRIGGER 7: log_negotiation_audit_after_update (AFTER UPDATE ON negotiation)
-- Enforces:
-- Comprehensive audit trail for any changes to deal terms or status
-- ============================================================
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

-- ============================================================
-- TRIGGER 8: prevent_closed_round_funding_reduction (BEFORE UPDATE ON funding_round)
-- Enforces:
-- Cannot lower target funding below capital already collected
-- ============================================================
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

-- ============================================================
-- TRIGGER 9: validate_match_result_before_insert (BEFORE INSERT ON match_result)
-- Enforces:
-- Match score must be between 0.00 and 100.00
-- ============================================================
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

-- Reset delimiter back to standard semicolon
DELIMITER ;

-- ============================================================
-- Verification query: list all active triggers on startup_funding_platform
-- ============================================================
SHOW TRIGGERS FROM `startup_funding_platform`;
