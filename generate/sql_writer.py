"""MySQL 8.0 Reference SQL queries for all 100 practice questions.

Every query strictly adheres to MySQL 8.0 syntax rules:
- No PostgreSQL cast operators (::type)
- No DATE_TRUNC, STRING_AGG, or PERCENTILE_CONT
- Standard MySQL date, math, string, and window functions
"""

from __future__ import annotations
from typing import Dict


REFERENCE_QUERIES: Dict[str, str] = {
    # 1. Histogram of Tweets (Twitter, Easy)
    "sql-histogram-tweets": """
WITH user_tweets AS (
  SELECT user_id, COUNT(tweet_id) AS tweet_count
  FROM tweets
  WHERE YEAR(tweet_date) = 2022
  GROUP BY user_id
)
SELECT tweet_count AS tweet_bucket, COUNT(user_id) AS users_num
FROM user_tweets
GROUP BY tweet_count
ORDER BY tweet_bucket;
""",

    # 2. Data Science Skills (LinkedIn, Easy)
    "matching-skills": """
SELECT candidate_id
FROM candidates
WHERE skill IN ('Python', 'Tableau', 'PostgreSQL')
GROUP BY candidate_id
HAVING COUNT(DISTINCT skill) = 3
ORDER BY candidate_id;
""",

    # 3. Page With No Likes (Facebook, Easy)
    "sql-page-with-no-likes": """
SELECT p.page_id
FROM pages p
LEFT JOIN page_likes l ON p.page_id = l.page_id
WHERE l.page_id IS NULL
ORDER BY p.page_id;
""",

    # 4. Unfinished Parts (Tesla, Easy)
    "tesla-unfinished-parts": """
SELECT part, assembly_step
FROM parts_assembly
WHERE finish_date IS NULL
ORDER BY part, assembly_step;
""",

    # 5. Laptop vs. Mobile Viewership (NY Times, Easy)
    "laptop-mobile-viewership": """
SELECT 
  SUM(CASE WHEN device_type = 'laptop' THEN 1 ELSE 0 END) AS laptop_views,
  SUM(CASE WHEN device_type IN ('tablet', 'phone') THEN 1 ELSE 0 END) AS mobile_views
FROM viewership;
""",

    # 6. Average Post Hiatus (Part 1) (Facebook, Easy)
    "sql-average-post-hiatus-1": """
SELECT 
  user_id,
  DATEDIFF(MAX(post_date), MIN(post_date)) AS days_between
FROM posts
WHERE YEAR(post_date) = 2021
GROUP BY user_id
HAVING COUNT(post_id) >= 2
ORDER BY user_id;
""",

    # 7. Teams Power Users (Microsoft, Easy)
    "teams-power-users": """
SELECT sender_id, COUNT(message_id) AS message_count
FROM messages
WHERE YEAR(sent_date) = 2022 AND MONTH(sent_date) = 8
GROUP BY sender_id
ORDER BY message_count DESC, sender_id ASC
LIMIT 2;
""",

    # 8. Duplicate Job Listings (LinkedIn, Easy)
    "duplicate-job-listings": """
WITH job_counts AS (
  SELECT company_id, title, description, COUNT(job_id) AS post_count
  FROM job_listings
  GROUP BY company_id, title, description
  HAVING COUNT(job_id) > 1
)
SELECT COUNT(DISTINCT company_id) AS duplicate_companies
FROM job_counts;
""",

    # 9. Cities With Completed Trades (Robinhood, Easy)
    "completed-trades": """
SELECT u.city, COUNT(t.order_id) AS total_orders
FROM trades t
JOIN users u ON t.user_id = u.user_id
WHERE t.status = 'Completed'
GROUP BY u.city
ORDER BY total_orders DESC, u.city ASC
LIMIT 3;
""",

    # 10. Average Review Ratings (Amazon, Easy)
    "sql-avg-review-ratings": """
SELECT 
  MONTH(submit_date) AS mth,
  product_id,
  ROUND(AVG(stars), 2) AS avg_stars
FROM reviews
GROUP BY MONTH(submit_date), product_id
ORDER BY mth, product_id;
""",

    # 11. Well Paid Employees (FAANG, Easy)
    "sql-well-paid-employees": """
SELECT e.employee_id, e.name AS employee_name
FROM employee e
JOIN employee m ON e.manager_id = m.employee_id
WHERE e.salary > m.salary
ORDER BY e.employee_id;
""",

    # 12. Final Account Balance (Paypal, Easy)
    "final-account-balance": """
SELECT 
  account_id,
  SUM(CASE WHEN transaction_type = 'Deposit' THEN amount ELSE -amount END) AS final_balance
FROM transactions
GROUP BY account_id
ORDER BY account_id;
""",

    # 13. QuickBooks vs TurboTax (Intuit, Easy)
    "quickbooks-vs-turbotax": """
SELECT 
  SUM(CASE WHEN product LIKE '%QuickBooks%' THEN 1 ELSE 0 END) AS quickbooks_users,
  SUM(CASE WHEN product LIKE '%TurboTax%' THEN 1 ELSE 0 END) AS turbotax_users
FROM filed_taxes;
""",

    # 14. App Click-through Rate (CTR) (Facebook, Easy)
    "click-through-rate": """
SELECT 
  app_id,
  ROUND(100.0 * SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END), 0), 2) AS ctr
FROM events
WHERE YEAR(timestamp) = 2022
GROUP BY app_id
ORDER BY app_id;
""",

    # 15. Second Day Confirmation (TikTok, Easy)
    "second-day-confirmation": """
SELECT DISTINCT e.user_id
FROM emails e
JOIN texts t ON e.email_id = t.email_id
WHERE t.signup_action = 'Confirmed'
  AND DATEDIFF(t.action_date, e.signup_date) = 1
ORDER BY e.user_id;
""",

    # 16. IBM db2 Product Analytics (IBM, Easy)
    "sql-ibm-db2-product-analytics": """
WITH emp_query_counts AS (
  SELECT e.employee_id, COUNT(DISTINCT q.query_id) AS unique_queries
  FROM employees e
  LEFT JOIN queries q ON e.employee_id = q.employee_id 
    AND q.query_starttime >= '2023-07-01' 
    AND q.query_starttime < '2023-10-01'
  GROUP BY e.employee_id
)
SELECT unique_queries, COUNT(employee_id) AS employee_count
FROM emp_query_counts
GROUP BY unique_queries
ORDER BY unique_queries;
""",

    # 17. Cards Issued Difference (JPMorgan Chase, Easy)
    "cards-issued-difference": """
SELECT 
  card_name,
  MAX(issued_amount) - MIN(issued_amount) AS difference
FROM monthly_cards_issued
GROUP BY card_name
ORDER BY difference DESC, card_name ASC;
""",

    # 18. Compressed Mean (Alibaba, Easy)
    "alibaba-compressed-mean": """
SELECT 
  ROUND(SUM(item_count * order_occurrences) / SUM(order_occurrences), 1) AS mean
FROM items_per_order;
""",

    # 19. Pharmacy Analytics (Part 1) (CVS Health, Easy)
    "top-profitable-drugs": """
SELECT 
  drug,
  total_sales - cogs AS total_profit
FROM pharmacy_sales
ORDER BY total_profit DESC, drug ASC
LIMIT 3;
""",

    # 20. Pharmacy Analytics (Part 2) (CVS Health, Easy)
    "non-profitable-drugs": """
SELECT 
  manufacturer,
  COUNT(drug) AS drug_count,
  SUM(cogs - total_sales) AS total_loss
FROM pharmacy_sales
WHERE total_sales < cogs
GROUP BY manufacturer
ORDER BY total_loss DESC, manufacturer ASC;
""",

    # 21. Pharmacy Analytics (Part 3) (CVS Health, Easy)
    "total-drugs-sales": """
SELECT 
  manufacturer,
  CONCAT('$', ROUND(SUM(total_sales) / 1000000), ' million') AS sale
FROM pharmacy_sales
GROUP BY manufacturer
ORDER BY SUM(total_sales) DESC, manufacturer;
""",

    # 22. Patient Support Analysis (Part 1) (UnitedHealth, Easy)
    "frequent-callers": """
WITH policy_calls AS (
  SELECT policy_holder_id, COUNT(case_id) AS call_count
  FROM callers
  GROUP BY policy_holder_id
  HAVING COUNT(case_id) >= 3
)
SELECT COUNT(policy_holder_id) AS policy_holder_count
FROM policy_calls;
""",

    # 23. Most Expensive Purchase (Amazon, Easy)
    "most-expensive-purchase": """
SELECT 
  customer_id,
  ROUND(MAX(purchase_amount), 2) AS max_purchase
FROM transactions
GROUP BY customer_id
ORDER BY max_purchase DESC, customer_id ASC;
""",

    # 24. ApplePay Volume (Visa, Easy)
    "apple-pay-volume": """
SELECT 
  merchant_id,
  SUM(CASE WHEN LOWER(payment_method) = 'apple pay' THEN transaction_amount ELSE 0 END) AS total_transaction
FROM payments
GROUP BY merchant_id
ORDER BY total_transaction DESC, merchant_id ASC;
""",

    # 25. Subject Matter Experts (Accenture, Easy)
    "subject-matter-experts": """
SELECT employee_id
FROM employee_expertise
GROUP BY employee_id
HAVING MAX(years_of_experience) >= 8 
    OR (COUNT(DISTINCT domain) = 2 AND SUM(years_of_experience) >= 12)
ORDER BY employee_id;
""",

    # 26. LinkedIn Power Creators (Part 1) (LinkedIn, Medium)
    "linkedin-power-creators": """
SELECT p.profile_id
FROM personal_profiles p
JOIN company_pages c ON p.employer_id = c.company_id
WHERE p.followers > c.followers
ORDER BY p.profile_id;
""",

    # 27. Highest Number of Products (eBay, Medium)
    "sql-highest-products": """
SELECT user_id, COUNT(product_id) AS num_products
FROM user_transactions
GROUP BY user_id
ORDER BY COUNT(product_id) DESC, user_id
LIMIT 3;
""",

    # 28. Spare Server Capacity (Microsoft, Medium)
    "sql-spare-server-capacity": """
SELECT d.datacenter_id,
       d.monthly_capacity - IFNULL(SUM(f.monthly_demand), 0) AS spare_capacity
FROM datacenters d
LEFT JOIN forecasted_demand f ON d.datacenter_id = f.datacenter_id
GROUP BY d.datacenter_id, d.monthly_capacity
ORDER BY d.datacenter_id;
""",

    # 29. Top Rated Businesses (Yelp, Medium)
    "sql-top-businesses": """
WITH biz AS (
  SELECT business_id, MIN(review_stars) AS worst_review
  FROM reviews
  GROUP BY business_id
)
SELECT 
  SUM(CASE WHEN worst_review >= 4 THEN 1 ELSE 0 END) AS top_rated_businesses,
  ROUND(100.0 * SUM(CASE WHEN worst_review >= 4 THEN 1 ELSE 0 END) / COUNT(*), 0) AS top_rated_pct
FROM biz;
""",

    # 30. Ad Campaign ROAS (Google, Medium)
    "ad-campaign-roas": """
SELECT advertiser_id,
       ROUND(SUM(revenue) / SUM(spend), 2) AS roas
FROM ad_campaigns
GROUP BY advertiser_id
ORDER BY advertiser_id;
""",

    # 31. Product Line Revenue (NVIDIA, Medium)
    "revenue-by-product-line": """
SELECT p.product_line,
       SUM(t.amount) AS total_revenue
FROM transactions t
JOIN product_info p ON t.product_id = p.product_id
GROUP BY p.product_line
ORDER BY total_revenue DESC, p.product_line ASC;
""",

    # 32. Trade In Payouts (Apple, Medium)
    "trade-in-payouts": """
SELECT t.store_id,
       SUM(p.payout_amount) AS payout_total
FROM trade_in_transactions t
JOIN trade_in_payouts p ON t.model_id = p.model_id
GROUP BY t.store_id
ORDER BY payout_total DESC, t.store_id ASC;
""",

    # 33. Webinar Popularity (Snowflake, Medium)
    "snowflake-webinar-popularity": """
SELECT 
  ROUND(100.0 * SUM(CASE WHEN event_type = 'attended' THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN event_type = 'registered' THEN 1 ELSE 0 END), 0), 0) AS attendance_rate
FROM webinar_attendance;
""",

    # 34. Who Made Quota? (Oracle, Medium)
    "oracle-sales-quota": """
SELECT q.employee_id,
       CASE WHEN IFNULL(SUM(d.deal_size), 0) >= q.quota THEN 1 ELSE 0 END AS made_quota
FROM sales_quotas q
LEFT JOIN deals d ON q.employee_id = d.employee_id
GROUP BY q.employee_id, q.quota
ORDER BY q.employee_id;
""",

    # 35. User's Third Transaction (Uber, Medium)
    "sql-third-transaction": """
WITH ranked AS (
  SELECT user_id, spend, transaction_date,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY transaction_date) AS rn
  FROM transactions
)
SELECT user_id, spend, transaction_date
FROM ranked
WHERE rn = 3;
""",

    # 36. Second Highest Salary (FAANG, Medium)
    "sql-second-highest-salary": """
SELECT MAX(salary) AS second_highest_salary
FROM employee
WHERE salary < (SELECT MAX(salary) FROM employee);
""",

    # 37. Sending vs. Opening Snaps (Snapchat, Medium)
    "time-spent-snaps": """
SELECT 
  ab.age_bucket,
  ROUND(100.0 * SUM(CASE WHEN a.activity_type = 'send' THEN a.time_spent ELSE 0 END) / 
        SUM(CASE WHEN a.activity_type IN ('send', 'open') THEN a.time_spent ELSE 0 END), 2) AS send_perc,
  ROUND(100.0 * SUM(CASE WHEN a.activity_type = 'open' THEN a.time_spent ELSE 0 END) / 
        SUM(CASE WHEN a.activity_type IN ('send', 'open') THEN a.time_spent ELSE 0 END), 2) AS open_perc
FROM activities a
JOIN age_breakdown ab ON a.user_id = ab.user_id
WHERE a.activity_type IN ('send', 'open')
GROUP BY ab.age_bucket;
""",

    # 38. Tweets' Rolling Averages (Twitter, Medium)
    "rolling-average-tweets": """
SELECT 
  user_id,
  tweet_date,
  ROUND(AVG(tweet_count) OVER (
    PARTITION BY user_id 
    ORDER BY tweet_date 
    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
  ), 2) AS rolling_avg_3d
FROM tweets;
""",

    # 39. Highest-Grossing Items (Amazon, Medium)
    "sql-highest-grossing": """
WITH product_totals AS (
  SELECT 
    category,
    product,
    SUM(spend) AS total_spend,
    DENSE_RANK() OVER (PARTITION BY category ORDER BY SUM(spend) DESC) AS ranking
  FROM product_spend
  WHERE YEAR(transaction_date) = 2022
  GROUP BY category, product
)
SELECT category, product, total_spend
FROM product_totals
WHERE ranking <= 2
ORDER BY category, ranking, product;
""",

    # 40. Top Three Salaries (FAANG, Medium)
    "sql-top-three-salaries": """
WITH ranked AS (
  SELECT 
    d.department_name,
    e.name,
    e.salary,
    DENSE_RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) AS rnk
  FROM employee e
  JOIN department d ON e.department_id = d.department_id
)
SELECT department_name, name, salary
FROM ranked
WHERE rnk <= 3
ORDER BY department_name, salary DESC, name;
""",

    # 41. Signup Activation Rate (TikTok, Medium)
    "signup-confirmation-rate": """
SELECT 
  ROUND(COUNT(t.email_id) / COUNT(e.email_id), 2) AS confirm_rate
FROM emails e
LEFT JOIN texts t ON e.email_id = t.email_id AND t.signup_action = 'Confirmed';
""",

    # 42. Fill Missing Client Data (Accenture, Medium)
    "fill-missing-product": """
WITH filled AS (
  SELECT 
    product_id,
    COALESCE(category, FIRST_VALUE(category) OVER (ORDER BY product_id)) AS category,
    name
  FROM products
)
SELECT product_id, category, name FROM filled ORDER BY product_id;
""",

    # 43. Spotify Streaming History (Spotify, Medium)
    "spotify-streaming-history": """
WITH weekly_summary AS (
  SELECT user_id, song_id, COUNT(*) AS weekly_plays
  FROM songs_weekly
  WHERE listen_time <= '2022-08-04 23:59:59'
  GROUP BY user_id, song_id
),
combined AS (
  SELECT user_id, song_id, song_plays FROM songs_history
  UNION ALL
  SELECT user_id, song_id, weekly_plays FROM weekly_summary
)
SELECT user_id, song_id, SUM(song_plays) AS song_plays
FROM combined
GROUP BY user_id, song_id
ORDER BY song_plays DESC, user_id ASC, song_id ASC;
""",

    # 44. Mean, Median, Mode (Microsoft, Medium)
    "mean-median-mode": """
SELECT 
  ROUND(AVG(email_count)) AS mean,
  (SELECT email_count FROM inbox_stats ORDER BY email_count LIMIT 1 OFFSET (SELECT COUNT(*)/2 FROM inbox_stats)) AS median,
  (SELECT email_count FROM inbox_stats GROUP BY email_count ORDER BY COUNT(*) DESC LIMIT 1) AS mode
FROM inbox_stats;
""",

    # 45. Pharmacy Analytics (Part 4) (CVS Health, Medium)
    "top-drugs-sold": """
WITH ranked AS (
  SELECT manufacturer, drug,
         ROW_NUMBER() OVER (PARTITION BY manufacturer ORDER BY units_sold DESC) AS rn
  FROM pharmacy_sales
)
SELECT manufacturer, drug
FROM ranked
WHERE rn <= 2
ORDER BY manufacturer, rn;
""",

    # 46. Frequently Purchased Pairs (Walmart, Medium)
    "frequently-purchased-pairs": """
SELECT a.product_name AS product1, b.product_name AS product2
FROM products a
JOIN products b ON a.user_id = b.user_id AND a.product_id < b.product_id
GROUP BY a.product_name, b.product_name
ORDER BY a.product_name, b.product_name;
""",

    # 47. Supercloud Customer (Microsoft, Medium)
    "supercloud-customer": """
SELECT c.customer_id
FROM customer_contracts c
JOIN products p ON c.product_id = p.product_id
GROUP BY c.customer_id
HAVING COUNT(DISTINCT p.product_category) = (SELECT COUNT(DISTINCT product_category) FROM products)
ORDER BY c.customer_id;
""",

    # 48. Odd and Even Measurements (Google, Medium)
    "odd-even-measurements": """
WITH ranked AS (
  SELECT 
    CAST(measurement_time AS DATE) AS measurement_day,
    measurement_value,
    ROW_NUMBER() OVER (PARTITION BY CAST(measurement_time AS DATE) ORDER BY measurement_time) AS rn
  FROM measurements
)
SELECT 
  measurement_day,
  SUM(CASE WHEN rn % 2 = 1 THEN measurement_value ELSE 0 END) AS odd_sum,
  SUM(CASE WHEN rn % 2 = 0 THEN measurement_value ELSE 0 END) AS even_sum
FROM ranked
GROUP BY measurement_day
ORDER BY measurement_day;
""",

    # 49. Swapped Food Delivery (Zomato, Medium)
    "sql-swapped-food-delivery": """
SELECT 
  order_id,
  CASE 
    WHEN order_id % 2 = 1 AND order_id = (SELECT MAX(order_id) FROM orders) THEN item
    WHEN order_id % 2 = 1 THEN LEAD(item, 1) OVER (ORDER BY order_id)
    ELSE LAG(item, 1) OVER (ORDER BY order_id)
  END AS item
FROM orders
ORDER BY order_id;
""",

    # 50. FAANG Stock Min-Max (Part 1) (Bloomberg, Medium)
    "sql-bloomberg-stock-min-max-1": """
WITH ranked AS (
  SELECT 
    ticker,
    DATE_FORMAT(date, '%b-%Y') AS mth,
    open AS open_price,
    ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY open DESC) AS rn_high,
    ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY open ASC) AS rn_low
  FROM stock_prices
)
SELECT 
  h.ticker, 
  h.mth AS highest_mth, 
  h.open_price AS highest_open, 
  l.mth AS lowest_mth, 
  l.open_price AS lowest_open
FROM (SELECT ticker, mth, open_price FROM ranked WHERE rn_high = 1) h
JOIN (SELECT ticker, mth, open_price FROM ranked WHERE rn_low = 1) l ON h.ticker = l.ticker
ORDER BY h.ticker;
""",

    # 51. Booking Referral Source (Airbnb, Medium)
    "booking-referral-source": """
WITH rental_lists AS (
  SELECT 
    rental_id,
    GROUP_CONCAT(amenities ORDER BY amenities) AS amenity_list
  FROM rental_amenities
  GROUP BY rental_id
)
SELECT COUNT(*) AS substitutes
FROM rental_lists r1
JOIN rental_lists r2
  ON r1.amenity_list = r2.amenity_list
 AND r1.rental_id < r2.rental_id;
""",

    # 52. Best-Selling Product (eBay, Medium)
    "best-selling-products": """
WITH ranked AS (
  SELECT p.category_name, p.product_name, ps.sales_quantity,
         ROW_NUMBER() OVER (PARTITION BY p.category_name ORDER BY ps.sales_quantity DESC) AS rn
  FROM products p
  JOIN product_sales ps ON p.product_id = ps.product_id
)
SELECT category_name, product_name, sales_quantity
FROM ranked
WHERE rn = 1
ORDER BY category_name;
""",

    # 53. User Shopping Sprees (Amazon, Medium)
    "amazon-shopping-spree": """
WITH dates AS (
  SELECT DISTINCT user_id, CAST(transaction_date AS DATE) AS tx_date
  FROM transactions
),
streaks AS (
  SELECT user_id, tx_date,
         LEAD(tx_date, 1) OVER (PARTITION BY user_id ORDER BY tx_date) AS d1,
         LEAD(tx_date, 2) OVER (PARTITION BY user_id ORDER BY tx_date) AS d2
  FROM dates
)
SELECT DISTINCT user_id
FROM streaks
WHERE DATEDIFF(d1, tx_date) = 1 AND DATEDIFF(d2, d1) = 1
ORDER BY user_id;
""",

    # 54. 2nd Ride Delay (Uber, Medium)
    "2nd-ride-delay": """
WITH ranked_rides AS (
  SELECT user_id, ride_date,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY ride_date) AS rn
  FROM rides
)
SELECT 
  ROUND(AVG(DATEDIFF(r.ride_date, u.registration_date)), 2) AS avg_delay
FROM users u
JOIN ranked_rides r ON u.user_id = r.user_id AND r.rn = 2;
""",

    # 55. Histogram of Users and Purchases (Walmart, Medium)
    "histogram-users-purchases": """
WITH ranked AS (
  SELECT user_id, product_id, spend, transaction_date,
         DENSE_RANK() OVER (PARTITION BY user_id ORDER BY transaction_date DESC) AS rn
  FROM user_transactions
)
SELECT 
  DATE(transaction_date) AS transaction_date,
  user_id,
  COUNT(product_id) AS purchase_count
FROM ranked
WHERE rn = 1
GROUP BY transaction_date, user_id
ORDER BY transaction_date, user_id;
""",

    # 56. Google Maps Flagged UGC (Google, Medium)
    "off-topic-maps-ugc": """
SELECT p.place_name, COUNT(u.content_id) AS off_topic_count
FROM places p
JOIN ugc u ON p.place_id = u.place_id
WHERE u.content_tag = 'Off-topic'
GROUP BY p.place_name
ORDER BY off_topic_count DESC, p.place_name
LIMIT 1;
""",

    # 57. Compressed Mode (Alibaba, Medium)
    "alibaba-compressed-mode": """
SELECT item_count AS mode
FROM items_per_order
WHERE order_occurrences = (SELECT MAX(order_occurrences) FROM items_per_order)
ORDER BY item_count;
""",

    # 58. Card Launch Success (JPMorgan Chase, Medium)
    "card-launch-success": """
WITH launch_dates AS (
  SELECT card_name, issue_year, issue_month, issued_amount,
         ROW_NUMBER() OVER (PARTITION BY card_name ORDER BY issue_year, issue_month) AS rn
  FROM monthly_cards_issued
)
SELECT card_name, issued_amount
FROM launch_dates
WHERE rn = 1
ORDER BY issued_amount DESC, card_name ASC;
""",

    # 59. International Call Percentage (Verizon, Medium)
    "international-call-percentage": """
SELECT 
  ROUND(100.0 * SUM(CASE WHEN c.country_id != r.country_id THEN 1 ELSE 0 END) / COUNT(*), 1) AS international_calls_pct
FROM phone_calls p
JOIN phone_info c ON p.caller_id = c.caller_id
JOIN phone_info r ON p.receiver_id = r.caller_id;
""",

    # 60. Patient Support Analysis (Part 2) (UnitedHealth, Medium)
    "uncategorized-calls-percentage": """
SELECT 
  ROUND(100.0 * SUM(CASE WHEN call_category IS NULL OR call_category = 'n/a' THEN 1 ELSE 0 END) / COUNT(*), 1) AS uncategorised_call_pct
FROM callers;
""",

    # 61. LinkedIn Power Creators (Part 2) (LinkedIn, Medium)
    "linkedin-power-creators-part2": """
SELECT p.profile_id
FROM personal_profiles p
WHERE p.followers > 10000
ORDER BY p.profile_id;
""",

    # 62. Unique Money Transfer Relationships (PayPal, Medium)
    "money-transfer-relationships": """
WITH unique_pairs AS (
  SELECT DISTINCT
    LEAST(payer_id, recipient_id) AS p1,
    GREATEST(payer_id, recipient_id) AS p2
  FROM payments
)
SELECT COUNT(*) AS unique_relationships FROM unique_pairs;
""",

    # 63. User Session Activity (Twitter, Medium)
    "user-session-activity": """
SELECT user_id,
       session_type,
       RANK() OVER (PARTITION BY session_type ORDER BY SUM(duration) DESC) AS ranking
FROM sessions
WHERE start_date >= '2020-01-01' AND start_date < '2020-02-01'
GROUP BY user_id, session_type
ORDER BY session_type, ranking, user_id;
""",

    # 64. First Transaction (Etsy, Medium)
    "sql-first-transaction": """
WITH first_orders AS (
  SELECT user_id, spend,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY transaction_date) AS rn
  FROM user_transactions
)
SELECT COUNT(user_id) AS users
FROM first_orders
WHERE rn = 1 AND spend >= 50;
""",

    # 65. Email Table Transformation (Facebook, Medium)
    "email-table-transformation": """
SELECT 
  user_id,
  MAX(CASE WHEN action_type = 'open' THEN action_date END) AS open_date,
  MAX(CASE WHEN action_type = 'click' THEN action_date END) AS click_date
FROM email_logs
GROUP BY user_id
ORDER BY user_id;
""",

    # 66. Photoshop Revenue Analysis (Adobe, Medium)
    "photoshop-revenue-analysis": """
SELECT customer_id, SUM(revenue) AS revenue
FROM adobe_transactions
WHERE customer_id IN (
  SELECT customer_id FROM adobe_transactions WHERE product = 'Photoshop'
) AND product != 'Photoshop'
GROUP BY customer_id
ORDER BY customer_id;
""",

    # 67. Consulting Bench Time (Google, Medium)
    "consulting-bench-time": """
SELECT s.employee_id,
       365 - SUM(DATEDIFF(e.end_date, e.start_date) + 1) AS bench_days
FROM staffing s
JOIN consulting_engagements e ON s.job_id = e.job_id
WHERE s.is_consultant = 1
GROUP BY s.employee_id
ORDER BY s.employee_id;
""",

    # 68. Sales Team Compensation (Oracle, Medium)
    "sales-team-compensation": """
WITH deal_totals AS (
  SELECT employee_id, SUM(deal_size) AS total_deals
  FROM deals
  GROUP BY employee_id
)
SELECT 
  c.employee_id,
  ROUND(c.base + 
    CASE 
      WHEN IFNULL(d.total_deals, 0) >= c.quota THEN (c.commission * c.quota) + (c.accelerator * (d.total_deals - c.quota))
      ELSE c.commission * IFNULL(d.total_deals, 0)
    END, 2) AS total_compensation
FROM employee_contract c
LEFT JOIN deal_totals d ON c.employee_id = d.employee_id
ORDER BY total_compensation DESC, c.employee_id;
""",

    # 69. Average Deal Size (Part 2) (Salesforce, Medium)
    "sql-average-deal-size-2": """
SELECT 
  CASE 
    WHEN num_seats < 20 THEN 'Small'
    WHEN num_seats BETWEEN 20 AND 99 THEN 'Medium'
    ELSE 'Large'
  END AS tier,
  ROUND(AVG(deal_size), 2) AS avg_deal_size
FROM deals
WHERE status = 'Won'
GROUP BY 
  CASE 
    WHEN num_seats < 20 THEN 'Small'
    WHEN num_seats BETWEEN 20 AND 99 THEN 'Medium'
    ELSE 'Large'
  END
ORDER BY avg_deal_size DESC, tier ASC;
""",

    # 70. Cumulative Purchases by Product Type (Amazon, Medium)
    "sql-purchasing-activity": """
SELECT 
  order_date,
  product_type,
  ROUND(SUM(spend) OVER (PARTITION BY product_type ORDER BY order_date), 2) AS cum_spend
FROM purchases
ORDER BY product_type, order_date;
""",

    # 71. Invalid Search Results (Google, Medium)
    "invalid-search-pct": """
SELECT 
  ROUND(100.0 * SUM(CASE WHEN is_invalid = 1 OR num_results = 0 THEN 1 ELSE 0 END) / COUNT(*), 2) AS invalid_pct
FROM search_category;
""",

    # 72. Compensation Outliers (Accenture, Medium)
    "compensation-outliers": """
WITH dept_stats AS (
  SELECT department_id, AVG(salary) AS avg_sal
  FROM employee_pay
  GROUP BY department_id
)
SELECT e.employee_id, e.salary, 'Higher' AS status
FROM employee_pay e
JOIN dept_stats d ON e.department_id = d.department_id
WHERE e.salary > 2 * d.avg_sal
ORDER BY e.employee_id;
""",

    # 73. FAANG Stock Monthly Change (Part 2) (Bloomberg, Medium)
    "sql-bloomberg-stock-monthly-change": """
WITH monthly AS (
  SELECT 
    ticker,
    DATE_FORMAT(date, '%Y-%m') AS ym,
    close,
    ROW_NUMBER() OVER (PARTITION BY ticker, DATE_FORMAT(date, '%Y-%m') ORDER BY date DESC) AS rn
  FROM stock_prices
),
eom AS (
  SELECT ticker, ym, close
  FROM monthly
  WHERE rn = 1
)
SELECT 
  ticker,
  ym,
  close,
  ROUND(close - LAG(close) OVER (PARTITION BY ticker ORDER BY ym), 2) AS change_amt
FROM eom
ORDER BY ticker, ym;
""",

    # 74. Active User Retention (Facebook, Hard)
    "user-retention": """
WITH monthly_users AS (
  SELECT DISTINCT 
    user_id, 
    MONTH(event_date) AS mth
  FROM user_actions
  WHERE event_type IN ('sign-in', 'like', 'comment')
    AND YEAR(event_date) = 2022
)
SELECT 
  curr.mth,
  COUNT(DISTINCT curr.user_id) AS monthly_active_users
FROM monthly_users curr
JOIN monthly_users prev 
  ON curr.user_id = prev.user_id 
 AND curr.mth = prev.mth + 1
WHERE curr.mth = 7
GROUP BY curr.mth;
""",

    # 75. Y-on-Y Growth Rate (Wayfair, Hard)
    "yoy-growth-rate": """
WITH yearly_spend AS (
  SELECT 
    YEAR(transaction_date) AS yr,
    product_id,
    spend AS curr_year_spend,
    LAG(spend) OVER (PARTITION BY product_id ORDER BY YEAR(transaction_date)) AS prev_year_spend
  FROM user_transactions
)
SELECT 
  yr,
  product_id,
  curr_year_spend,
  prev_year_spend,
  ROUND(100.0 * (curr_year_spend - prev_year_spend) / prev_year_spend, 2) AS yoy_rate
FROM yearly_spend
ORDER BY product_id, yr;
""",

    # 76. Maximize Prime Item Inventory (Amazon, Hard)
    "prime-warehouse-storage": """
WITH summary AS (
  SELECT 
    item_type,
    SUM(square_footage) AS total_sqft,
    COUNT(item_id) AS item_count
  FROM inventory
  GROUP BY item_type
),
prime_calc AS (
  SELECT 
    'prime_eligible' AS item_type,
    FLOOR(500000 / total_sqft) * item_count AS total_items,
    FLOOR(500000 / total_sqft) * total_sqft AS total_sqft_used
  FROM summary
  WHERE item_type = 'prime_eligible'
),
not_prime_calc AS (
  SELECT 
    'not_prime' AS item_type,
    FLOOR((500000 - p.total_sqft_used) / s.total_sqft) * s.item_count AS total_items
  FROM summary s
  CROSS JOIN prime_calc p
  WHERE s.item_type = 'not_prime'
)
SELECT item_type, total_items FROM prime_calc
UNION ALL
SELECT item_type, total_items FROM not_prime_calc;
""",

    # 77. Median Google Search Frequency (Google, Hard)
    "median-search-freq": """
WITH expanded AS (
  SELECT searches, num_users,
         SUM(num_users) OVER (ORDER BY searches) AS cum_users,
         SUM(num_users) OVER () AS total_users
  FROM search_frequency
)
SELECT ROUND(AVG(searches), 1) AS median
FROM expanded
WHERE cum_users >= total_users / 2.0
LIMIT 1;
""",

    # 78. Advertiser Status (Facebook, Hard)
    "updated-status": """
SELECT 
  COALESCE(a.user_id, d.user_id) AS user_id,
  CASE 
    WHEN a.status IS NULL THEN 'NEW'
    WHEN d.paid IS NULL THEN 'CHURN'
    WHEN a.status = 'CHURN' AND d.paid > 0 THEN 'RESURRECT'
    ELSE 'EXISTING'
  END AS new_status
FROM advertiser a
LEFT JOIN daily_pay d ON a.user_id = d.user_id
ORDER BY user_id;
""",

    # 79. Consecutive Filing Years (Intuit, Hard)
    "consecutive-filing-years": """
WITH yearly AS (
  SELECT DISTINCT user_id, YEAR(filing_date) AS filing_year
  FROM filed_taxes
),
ranked AS (
  SELECT user_id, filing_year,
         filing_year - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY filing_year) AS grp
  FROM yearly
)
SELECT DISTINCT user_id
FROM ranked
GROUP BY user_id, grp
HAVING COUNT(*) >= 3
ORDER BY user_id;
""",

    # 80. Marketing Touch Streak (Snowflake, Hard)
    "marketing-touch-streak": """
SELECT c.email
FROM crm_contacts c
JOIN marketing_touches m ON c.contact_id = m.contact_id
WHERE m.event_type = 'webinar'
GROUP BY c.email
HAVING COUNT(m.event_id) >= 2
ORDER BY c.email;
""",

    # 81. 3-Topping Pizzas (Domino's, Hard)
    "pizzas-topping-cost": """
SELECT 
  CONCAT(p1.topping_name, ',', p2.topping_name, ',', p3.topping_name) AS pizza,
  ROUND(p1.ingredient_cost + p2.ingredient_cost + p3.ingredient_cost, 2) AS total_cost
FROM pizza_toppings p1
JOIN pizza_toppings p2 ON p1.topping_name < p2.topping_name
JOIN pizza_toppings p3 ON p2.topping_name < p3.topping_name
ORDER BY total_cost DESC, pizza;
""",

    # 82. Patient Support Analysis (Part 3) (UnitedHealth, Hard)
    "patient-call-history": """
SELECT policy_holder_id, COUNT(case_id) AS total_calls
FROM callers
GROUP BY policy_holder_id
HAVING COUNT(case_id) > 1
ORDER BY total_calls DESC, policy_holder_id;
""",

    # 83. Patient Support Analysis (Part 4) (UnitedHealth, Hard)
    "long-calls-growth": """
WITH monthly_calls AS (
  SELECT 
    DATE_FORMAT(call_date, '%Y-%m') AS ym,
    COUNT(case_id) AS long_call_count
  FROM callers
  WHERE call_duration_secs > 300
  GROUP BY DATE_FORMAT(call_date, '%Y-%m')
)
SELECT 
  ym,
  long_call_count,
  ROUND(100.0 * (long_call_count - LAG(long_call_count) OVER (ORDER BY ym)) / 
        NULLIF(LAG(long_call_count) OVER (ORDER BY ym), 0), 1) AS growth_pct
FROM monthly_calls
ORDER BY ym;
""",

    # 84. Repeated Payments (Stripe, Hard)
    "repeated-payments": """
WITH ordered_payments AS (
  SELECT 
    merchant_id,
    credit_card_id,
    amount,
    transaction_timestamp,
    LAG(transaction_timestamp) OVER (
      PARTITION BY merchant_id, credit_card_id, amount 
      ORDER BY transaction_timestamp
    ) AS prev_timestamp
  FROM transactions
)
SELECT COUNT(*) AS repeated_payments
FROM ordered_payments
WHERE prev_timestamp IS NOT NULL
  AND TIMESTAMPDIFF(MINUTE, prev_timestamp, transaction_timestamp) <= 10;
""",

    # 85. Reactivated Users (Facebook, Hard)
    "reactivated-users": """
WITH user_months AS (
  SELECT DISTINCT user_id, MONTH(login_date) AS mth
  FROM user_logins
)
SELECT 
  curr.mth,
  COUNT(DISTINCT curr.user_id) AS reactivated_users
FROM user_months curr
LEFT JOIN user_months prev ON curr.user_id = prev.user_id AND curr.mth = prev.mth + 1
WHERE prev.user_id IS NULL AND curr.mth > 1
GROUP BY curr.mth
ORDER BY curr.mth;
""",

    # 86. Senior Managers (Google, Hard)
    "senior-managers-reportees": """
SELECT manager_name, COUNT(emp_id) AS direct_reports
FROM employees
WHERE manager_id IS NOT NULL
GROUP BY manager_name
HAVING COUNT(emp_id) >= 5
ORDER BY direct_reports DESC, manager_name;
""",

    # 87. Server Utilization Time (Amazon, Hard)
    "total-utilization-time": """
WITH session_pairs AS (
  SELECT 
    server_id,
    status_time AS start_time,
    LEAD(status_time) OVER (PARTITION BY server_id ORDER BY status_time) AS stop_time,
    session_status
  FROM server_utilization
)
SELECT 
  FLOOR(SUM(TIMESTAMPDIFF(SECOND, start_time, stop_time)) / 86400) AS total_uptime_days
FROM session_pairs
WHERE session_status = 'start' AND stop_time IS NOT NULL;
""",

    # 88. FAANG Underperforming Stocks (Part 3) (Bloomberg, Hard)
    "sql-bloomberg-underperforming-stocks": """
SELECT ticker, ROUND(AVG(close - open), 2) AS avg_return
FROM stock_prices
GROUP BY ticker
HAVING AVG(close - open) < 0
ORDER BY avg_return ASC, ticker ASC;
""",

    # 89. User Concurrent Sessions (Twitter, Hard)
    "concurrent-user-sessions": """
SELECT 
  a.session_id,
  COUNT(b.session_id) AS concurrent_sessions
FROM user_sessions a
JOIN user_sessions b 
  ON a.user_id = b.user_id 
 AND a.session_id != b.session_id 
 AND a.start_time < b.end_time 
 AND a.end_time > b.start_time
GROUP BY a.session_id
ORDER BY concurrent_sessions DESC, a.session_id;
""",

    # 90. Monthly Merchant Balance (Visa, Hard)
    "sql-monthly-merchant-balance": """
SELECT 
  DATE_FORMAT(transaction_date, '%Y-%m') AS transaction_month,
  SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END) AS balance
FROM transactions
GROUP BY DATE_FORMAT(transaction_date, '%Y-%m')
ORDER BY transaction_month;
""",

    # 91. Bad Delivery Rate (DoorDash, Hard)
    "sql-bad-experience": """
SELECT 
  ROUND(100.0 * SUM(CASE WHEN t.actual_delivery_timestamp > t.estimated_delivery_timestamp THEN 1 ELSE 0 END) / COUNT(*), 2) AS bad_experience_pct
FROM orders o
JOIN trips t ON o.trip_id = t.trip_id
JOIN customers c ON o.customer_id = c.customer_id
WHERE DATEDIFF(o.order_timestamp, c.signup_timestamp) <= 14;
""",

    # 92. Page Recommendation (Facebook, Hard)
    "page-recommendation": """
SELECT DISTINCT f.user_id, pl.page_id AS recommended_page
FROM friendship f
JOIN page_likes pl ON f.friend_id = pl.user_id
LEFT JOIN page_likes my_likes ON f.user_id = my_likes.user_id AND pl.page_id = my_likes.page_id
WHERE my_likes.page_id IS NULL
ORDER BY f.user_id, recommended_page;
""",

    # 93. Event Friends Recommendation (Facebook, Hard)
    "event-friends-rec": """
SELECT DISTINCT e1.user_id, e2.user_id AS friend_id
FROM event_rsvp e1
JOIN event_rsvp e2 ON e1.event_id = e2.event_id AND e1.user_id < e2.user_id
LEFT JOIN friendship_status f ON (e1.user_id = f.user_a_id AND e2.user_id = f.user_b_id)
                              OR (e1.user_id = f.user_b_id AND e2.user_id = f.user_a_id)
WHERE f.status IS NULL OR f.status != 'Friends'
ORDER BY e1.user_id, friend_id;
""",

    # 94. Matching Rental Amenities (Airbnb, Hard)
    "matching-rental-amenities": """
SELECT a.rental_id AS rental_1, b.rental_id AS rental_2, COUNT(a.amenity) AS matching_amenities
FROM rental_amenities a
JOIN rental_amenities b ON a.amenity = b.amenity AND a.rental_id < b.rental_id
GROUP BY a.rental_id, b.rental_id
HAVING COUNT(a.amenity) >= 2
ORDER BY matching_amenities DESC, rental_1, rental_2;
""",

    # 95. First Month Retention (Facebook, Hard)
    "first-month-retention": """
SELECT 
  ROUND(100.0 * COUNT(DISTINCT a.user_id) / COUNT(DISTINCT u.user_id), 2) AS retention_rate
FROM users u
LEFT JOIN user_actions a 
  ON u.user_id = a.user_id 
 AND DATEDIFF(a.event_date, u.signup_date) BETWEEN 1 AND 30;
""",

    # 96. Uniquely Staffed Consultants (Accenture, Hard)
    "uniquely-staffed-consultants": """
SELECT s.employee_id
FROM staffing s
JOIN engagements e ON s.engagement_id = e.engagement_id
GROUP BY s.employee_id
HAVING COUNT(DISTINCT e.client_name) = 1
ORDER BY s.employee_id;
""",

    # 97. Compressed Median (Alibaba, Hard)
    "alibaba-compressed-median": """
WITH running AS (
  SELECT 
    item_count,
    order_occurrences,
    SUM(order_occurrences) OVER (ORDER BY item_count) AS cum_orders,
    SUM(order_occurrences) OVER () AS total_orders
  FROM items_per_order
)
SELECT ROUND(AVG(item_count), 1) AS median
FROM running
WHERE cum_orders >= total_orders / 2.0
LIMIT 1;
""",

    # 98. Average Vacant Days (Airbnb, Hard)
    "average-vacant-days": """
SELECT 
  ROUND(AVG(365 - IFNULL(DATEDIFF(b.checkout_date, b.checkin_date), 0)), 1) AS avg_vacant_days
FROM listings l
LEFT JOIN bookings b ON l.listing_id = b.listing_id
WHERE l.is_active = 1;
""",

    # 99. Same Week Purchases (Etsy, Hard)
    "same-week-purchases": """
SELECT 
  ROUND(100.0 * COUNT(DISTINCT p.user_id) / COUNT(DISTINCT s.user_id), 2) AS same_week_pct
FROM signups s
LEFT JOIN purchases p 
  ON s.user_id = p.user_id 
 AND DATEDIFF(p.purchase_date, s.signup_date) BETWEEN 0 AND 7;
""",

    # 100. Follow-Up Airpod Percentage (Apple, Hard)
    "follow-up-airpod-percentage": """
WITH ordered_purchases AS (
  SELECT 
    customer_id,
    product_name,
    transaction_timestamp,
    LEAD(product_name) OVER (PARTITION BY customer_id ORDER BY transaction_timestamp) AS next_product
  FROM transactions
)
SELECT 
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN product_name = 'iPhone' AND next_product = 'AirPods' THEN customer_id END) / 
        NULLIF(COUNT(DISTINCT CASE WHEN product_name = 'iPhone' THEN customer_id END), 0), 0) AS follow_up_percentage
FROM ordered_purchases;
"""
}
