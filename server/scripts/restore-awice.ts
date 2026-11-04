import { query, pool } from '../src/db/client'

async function restore() {
  await query(`
    UPDATE users SET display_name = 'Alex Wice', solved_total = 3268, solved_easy = 805, solved_medium = 1701, solved_hard = 762, contest_rating = 3091.40, contests_attended = 221, fetch_status = 'ok' WHERE leetcode_username = 'awice';
    UPDATE users SET display_name = 'Neal Wu', solved_total = 253, solved_easy = 60, solved_medium = 141, solved_hard = 52, contest_rating = 3686.20, contests_attended = 51, fetch_status = 'ok' WHERE leetcode_username = 'neal_wu';
    UPDATE users SET display_name = 'lee', solved_total = 695, solved_easy = 127, solved_medium = 416, solved_hard = 152, contest_rating = 2204.30, contests_attended = 27, fetch_status = 'ok' WHERE leetcode_username = 'lee215';
    UPDATE users SET display_name = 'Gennady', solved_total = 4, solved_easy = 1, solved_medium = 2, solved_hard = 1, contest_rating = NULL, contests_attended = NULL, fetch_status = 'ok' WHERE leetcode_username = 'tourist';
    UPDATE users SET display_name = 'yosupo', solved_total = 2, solved_easy = 1, solved_medium = 1, solved_hard = 0, contest_rating = NULL, contests_attended = NULL, fetch_status = 'ok' WHERE leetcode_username = 'yosupo';
    UPDATE users SET display_name = 'Benjamin Qi', solved_total = 13, solved_easy = 3, solved_medium = 5, solved_hard = 5, contest_rating = NULL, contests_attended = NULL, fetch_status = 'ok' WHERE leetcode_username = 'bqi343';
    DELETE FROM users WHERE leetcode_username IN ('comm_test_user_isolated', 'comm_test_user_shared');
  `)
  console.log('Restored all seed user stats.')
  await pool.end()
}

restore().catch(console.error)
