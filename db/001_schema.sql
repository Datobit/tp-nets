BEGIN;

CREATE TABLE employees (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name text NOT NULL,
    last_name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    can_be_assigned boolean NOT NULL DEFAULT true
);

CREATE TABLE users (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id integer UNIQUE REFERENCES employees(id),
    email text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('worker', 'boss', 'technical')),
    is_active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));

CREATE TABLE locations (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL,
    address text NOT NULL
);

CREATE TABLE orders (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    location_id integer NOT NULL REFERENCES locations(id),
    title text NOT NULL,
    planned_scope text,
    status text NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'in_progress', 'done')),
    planned_end_date date,
    department text,
    place text,
    requested_by text,
    contact_phone text,
    preliminary_cost_net numeric(12,2) CHECK (preliminary_cost_net >= 0)
);

CREATE TABLE order_assignments (
    order_id integer NOT NULL REFERENCES orders(id),
    employee_id integer NOT NULL REFERENCES employees(id),
    PRIMARY KEY (order_id, employee_id)
);

CREATE TABLE materials (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL UNIQUE CHECK (btrim(name) <> ''),
    base_unit text NOT NULL CHECK (btrim(base_unit) <> ''),
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE material_purchases (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    material_id integer NOT NULL REFERENCES materials(id),
    purchase_date date NOT NULL,
    purchased_qty numeric(12,3) NOT NULL CHECK (purchased_qty > 0),
    total_price_net numeric(12,2) NOT NULL CHECK (total_price_net >= 0),
    UNIQUE (id, material_id)
);

CREATE TABLE order_planned_materials (
    order_id integer NOT NULL REFERENCES orders(id),
    material_id integer NOT NULL REFERENCES materials(id),
    planned_qty numeric(12,3) NOT NULL CHECK (planned_qty > 0),
    PRIMARY KEY (order_id, material_id)
);

CREATE TABLE work_reports (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id integer NOT NULL REFERENCES orders(id),
    created_by_user_id integer NOT NULL REFERENCES users(id),
    work_date date NOT NULL,
    place_details text,
    description text NOT NULL CHECK (btrim(description) <> ''),
    notes text,
    no_materials boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE report_employees (
    work_report_id integer NOT NULL REFERENCES work_reports(id),
    employee_id integer NOT NULL REFERENCES employees(id),
    start_time time NOT NULL DEFAULT '08:00',
    end_time time NOT NULL DEFAULT '16:00',
    PRIMARY KEY (work_report_id, employee_id),
    CHECK (end_time > start_time)
);

CREATE TABLE report_materials (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    work_report_id integer NOT NULL REFERENCES work_reports(id),
    material_id integer REFERENCES materials(id),
    custom_name text,
    used_qty numeric(12,3) NOT NULL CHECK (used_qty > 0),
    unit text NOT NULL CHECK (btrim(unit) <> ''),
    purchase_id integer,
    suggested_cost_net numeric(12,2) CHECK (suggested_cost_net >= 0),
    approved_cost_net numeric(12,2) CHECK (approved_cost_net >= 0),
    cost_note text,
    cost_approved_by_user_id integer REFERENCES users(id),
    cost_approved_at timestamptz,
    FOREIGN KEY (purchase_id, material_id)
        REFERENCES material_purchases(id, material_id),
    CHECK (purchase_id IS NULL OR material_id IS NOT NULL),
    CHECK (
        (material_id IS NOT NULL AND custom_name IS NULL)
        OR
        (material_id IS NULL AND custom_name IS NOT NULL AND btrim(custom_name) <> '')
    ),
    CHECK (
        (approved_cost_net IS NULL AND cost_approved_by_user_id IS NULL
         AND cost_approved_at IS NULL)
        OR
        (approved_cost_net IS NOT NULL AND cost_approved_by_user_id IS NOT NULL
         AND cost_approved_at IS NOT NULL)
    )
);

CREATE TABLE leave_requests (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id integer NOT NULL REFERENCES employees(id),
    start_date date NOT NULL,
    end_date date NOT NULL,
    note text,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by_user_id integer REFERENCES users(id),
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date),
    CHECK (
        (status = 'pending' AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL)
        OR
        (status <> 'pending' AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

CREATE INDEX work_reports_order_date_idx ON work_reports (order_id, work_date);
CREATE INDEX report_employees_employee_idx ON report_employees (employee_id);
CREATE INDEX report_materials_report_idx ON report_materials (work_report_id);
CREATE INDEX material_purchases_material_date_idx
    ON material_purchases (material_id, purchase_date DESC);
CREATE INDEX leave_requests_employee_dates_idx
    ON leave_requests (employee_id, start_date, end_date);

COMMIT;
