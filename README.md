# Vistula Task Manager Extended

Extended version of the Task Manager created for the **Team Project – IT** course at Vistula University
(optional advanced assignment). Tasks are grouped into **categories** stored in a separate related table,
and the application uses the Supabase REST API to read related data, filter tasks and manage categories.

## Student

- **Student ID:** 76034
- **GitHub account:** vistula-team-project-76034-lab

## Links

- **Live application:** https://vistula-team-project-76034-lab.github.io/vistula-task-manager-extended/
- **Repository:** https://github.com/vistula-team-project-76034-lab/vistula-task-manager-extended
- **Application info:** https://vistula-team-project-76034-lab.github.io/vistula-task-manager-extended/info.json
- **Statistics page:** https://vistula-team-project-76034-lab.github.io/vistula-task-manager-extended/statistics.html

## Features

- Display, create, edit and delete tasks; mark tasks as completed / incomplete
- Display categories and create new categories
- Assign a category to a task and change the category of an existing task
- Category name displayed next to every task
- Filter tasks by category and by completion status (filters can be combined,
  e.g. only incomplete tasks in the *University* category)
- All data stored in Supabase (PostgreSQL) and kept after page refresh

## Database structure

The database is a separate Supabase demonstration project (the database of the first assignment is not modified).
The full SQL is in [`database.sql`](database.sql).

**Table `categories`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | BIGINT | Primary key, generated automatically (identity) |
| `name` | TEXT | NOT NULL |

**Table `tasks`**

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | BIGINT | Primary key, generated automatically (identity) |
| `title` | TEXT | NOT NULL |
| `description` | TEXT | Optional |
| `completed` | BOOLEAN | NOT NULL, default `false` |
| `category_id` | BIGINT | Foreign key → `categories.id` (`ON DELETE RESTRICT`) |

Row Level Security is enabled on both tables. Public (publishable key) policies allow
`SELECT`/`INSERT` on `categories` and `SELECT`/`INSERT`/`UPDATE`/`DELETE` on `tasks`.

## Relationship between tasks and categories

It is a **one-to-many** relationship: **one category can contain many tasks, and each task belongs to one category.**

- `categories.id` is the **primary key** – it uniquely identifies a category.
- `tasks.category_id` is a **foreign key** – it stores the `id` of the category the task belongs to.
- PostgreSQL checks the foreign key, so a task cannot point to a category that does not exist,
  and a category that still has tasks cannot be deleted (`ON DELETE RESTRICT`).
- Because Supabase knows about this foreign key, the REST API can return each task together with
  its category name using `select=*,categories(name)` (similar to a SQL `JOIN`).

```
categories                 tasks
+----+------------+        +----+-----------------+-----------+-------------+
| id | name       |        | id | title           | completed | category_id |
+----+------------+        +----+-----------------+-----------+-------------+
|  1 | University | <----- |  1 | Learn SQL joins | false     |           1 |
|  2 | Work       | <--+   |  2 | Finish project  | false     |           1 |
|  3 | Personal   |    +-- |  3 | Weekly report   | true      |           2 |
+----+------------+        +----+-----------------+-----------+-------------+
```

## Example REST API requests

Base URL: `https://PROJECT_ID.supabase.co/rest/v1` – every request sends the header `apikey: <publishable key>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/categories?select=*` | Retrieve all categories |
| POST | `/categories` | Create a category – body `{"name": "Sport"}` |
| GET | `/tasks?select=*,categories(name)` | Retrieve tasks together with category names |
| GET | `/tasks?category_id=eq.1` | Retrieve tasks from category 1 (University) |
| GET | `/tasks?completed=eq.false` | Retrieve incomplete tasks |
| GET | `/tasks?select=*,categories(name)&category_id=eq.1&completed=eq.false` | Combined filter |
| POST | `/tasks` | Create a task – body `{"title": "...", "category_id": 1}` |
| PATCH | `/tasks?id=eq.1` | Update a task, including its category – body `{"category_id": 2}` |
| DELETE | `/tasks?id=eq.1` | Delete a task |

Example with `fetch()` (from `app.js`):

```js
fetch(SUPABASE_URL + '/rest/v1/tasks?id=eq.1', {
  method: 'PATCH',
  headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ category_id: 2 })
});
```

Example response of `GET /tasks?select=*,categories(name)`:

```json
[{"id":1,"title":"Learn SQL joins","description":"Practise foreign keys and joins","completed":false,"category_id":1,"categories":{"name":"University"}}]
```

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main page |
| `app.js` | Application logic (all REST API calls) |
| `style.css` | Styling |
| `config.json` | Public Supabase configuration (URL, publishable key, table names) |
| `info.json` | Application information (`studentId`, `applicationName`, `version`) |
| `database.sql` | SQL that creates the tables, the foreign key, RLS policies and demo data |
| `statistics.html` | Statistics page – added by my partner via Pull Request |

## Pull Requests (team collaboration)

**Status: pending.** I have not been assigned a partner yet, so the statistics page Pull Request exchange
has not been completed. Links to both merged Pull Requests will be added here once it is done.

- **Pull Request I created in my partner's repository:** pending
- **Pull Request I received and merged into my repository:** pending

Only the public Supabase **publishable** key is included in this repository. The database contains test data only.
