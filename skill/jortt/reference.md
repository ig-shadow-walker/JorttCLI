# jortt command reference

Generated from the CLI itself (`bun run reference`, `jortt skill install`); don't edit by hand.
Endpoint catalog synced from the Jortt docs on 2026-11-14.

Global options (put them anywhere): `--json`, `--fields a,b.c`, `--limit n`, `-v/--verbose`.
List commands also take `--page n` and `--all`. Write commands also take `-d/--data <json>`,
`--data-file <path|->`, `--set key.path=value` (repeatable) and `--no-validate`, and make a plan
(exit 2) that `jortt apply <plan-id>` sends. `*` marks required body fields.

## Contents

- System: setup, skill, apply, plans, auth, whoami
- customers
- invoices
- estimates
- expenses
- projects
- labels
- ledger-accounts
- payroll
- organizations
- tradenames
- inbox
- reports
- files
- bank
- payments
- receipts
- api, endpoints, describe

## setup

`jortt setup`  (alias: init)

Connect jortt to Jortt: asks for the Client ID and Secret, checks them, saves them, installs the Claude skill

- `--client-id <id>` Client ID of the Jortt app (otherwise asked, or the saved one)
- `--client-secret-stdin` Read the Client Secret from stdin (e.g. from a password manager)
- `--scopes <list>` Scopes to ask for (default: every scope jortt uses; trimmed to what the app has)
- `--organization-id <id>` Only when the credentials reach more than one administration
- `--skill` Install the Claude skill without asking
- `--no-skill` Don't install the Claude skill
- `--skill-dir <dir>` Install the skill here instead of ~/.claude/skills/jortt
- `--no-check` Save without contacting Jortt
- `--no-interactive` Never ask; use flags, environment and the saved file

## skill

The Claude skill that teaches Claude Code to use jortt

### skill install

`jortt skill install`

Install or update the skill (SKILL.md and a reference generated from this jortt)

- `--dir <dir>` Install here instead of ~/.claude/skills/jortt
- `--force` Replace a development symlink with a copy

## apply

`jortt apply <plan-id>`

Send a change that a write command planned (one plan, one apply)

## plans

Pending plans (writes waiting for `jortt apply`)

### plans list

`jortt plans list`

Plans that can still be applied

### plans show

`jortt plans show <plan-id>`

Show what a plan would send

### plans discard

`jortt plans discard <plan-id>`

Throw a plan away without sending it

## auth

Credentials and access token

### auth status

`jortt auth status`

Show which credentials and env files are used (no network)

### auth test

`jortt auth test`

Get a fresh token and read the administration, to check everything works

### auth refresh

`jortt auth refresh`

Throw away the cached token and get a new one

### auth clear

`jortt auth clear`

Delete the cached token

## whoami

`jortt whoami`

The Jortt administration these credentials act on

## customers

Customers (companies and private persons)

### customers list

`jortt customers list`

Returns a list of Customers

Calls `GET /v3/customers`.

- `--query <value>` Search query (at least 3 characters)
- `--page <number>` Page to fetch (100 per page)
- `--all` Fetch every page (stops at --limit)

### customers show

`jortt customers show <customer-id>`

Returns a Customer by ID

Calls `GET /v3/customers/{customer_id}`.

### customers create

`jortt customers create`

Creates a Customer

Calls `POST /v3/customers` (makes a plan).

- `--is-private <true|false>` Whether this Customer is a private person (true) or a company (false) (required)
- `--customer-name <value>` Either a company name (when is_private is false) or a private person's full name (when is_private i… (required)
- `--address-street <value>` Street and house number of the address of a Customer (required when is_private is false)
- `--address-postal-code <value>` Postal code of the address of a Customer (required when is_private is false)
- `--address-city <value>` City of the address of a Customer (required when is_private is false)
- `--address-country-code <value>` Country code of a Customer in ISO 3166-1 alpha-2 format (required when is_private is false, default…
- `--address-extra-information <value>` Extra line of Customer address information
- `--shift-vat <true|false>` Whether or not to shift the VAT for a Customer (applicable when is_private is false)
- `--vat-number <value>` The VAT number (BTW-nummer) of a Customer (applicable when is_private is false and shift_vat is tru…
- `--coc-number <value>` The Chamber of Commerce number (KvK-nummer) of a Customer (applicable when is_private is false)
- `--salutation <sir|madam|family>` The way a Customer is addressed (applicable when is_private is true)
- `--initials <value>` Initials of a Customer (applicable when is_private is true)
- `--first-name <value>` First name of a Customer (applicable when is_private is true)
- `--last-name <value>` Last name of a Customer (applicable when is_private is true)
- `--date-of-birth <value>` Date of birth of a Customer (applicable when is_private is true)
- `--citizen-service-number <value>` Citizen service number (BSN-nummer) of a Customer (applicable when is_private is true)
- `--attn <value>` To the attention of
- `--phonenumber <value>` A Customer's phone number
- `--website <value>` A Customer's website
- `--email <value>` E-mail address to send the Invoice to
- `--cc-emails <a,b,...>` An array of e-mail addresses to CC when the Invoice is sent
- `--email-salutation <value>` Salutation used in the e-mail (template) when sending an Invoice
- `--additional-information <value>` Extra Customer information
- `--payment-term <number>` Payment term for Invoices (in days, defaults to 30)
- `--invoice-language <nl|de|en|fr|es>` The language in which the Invoice will be translated
- `--payment-method-invoice <pay_later|direct_debit|already_paid>` How the Invoice can be paid.
- `--reference <value>` Custom reference (for example the ID of a customer in an external CRM)
- `--default-label-id <value>` Resource identifier (UUID) of the label to be set as default for a customer, which will automatical…
- `--default-ledger-account-id <value>` Resource identifier (UUID) of the ledger account to be set as default for a customer, which will au…
- `--default-discount-description <value>` Description a default discount to apply to any invoices or estimates created for this customer
- `--default-discount-percentage <number>` The default discount to apply expressed as a percentage
- `--peppol-scheme-code <value>` Prefix describing the scheme of the peppol identifier.
- `--peppol-identifier <number>` Code used to identify a Peppol legal entity.

Body fields:

```
is_private* (boolean)  Whether this Customer is a private person (true) or a company (false)
customer_name* (string)  Either a company name (when is_private is false) or a private person's full name (when is…
address_street (string)  Street and house number of the address of a Customer (required when is_private is false)
address_postal_code (string)  Postal code of the address of a Customer (required when is_private is false)
address_city (string)  City of the address of a Customer (required when is_private is false)
address_country_code (string)  Country code of a Customer in ISO 3166-1 alpha-2 format (required when is_private is fals…
address_extra_information (string)  Extra line of Customer address information
shift_vat (boolean)  Whether or not to shift the VAT for a Customer (applicable when is_private is false)
vat_number (string)  The VAT number (BTW-nummer) of a Customer (applicable when is_private is false and shift_…
coc_number (string)  The Chamber of Commerce number (KvK-nummer) of a Customer (applicable when is_private is …
salutation (string)  The way a Customer is addressed (applicable when is_private is true) [sir|madam|family]
initials (string)  Initials of a Customer (applicable when is_private is true)
first_name (string)  First name of a Customer (applicable when is_private is true)
last_name (string)  Last name of a Customer (applicable when is_private is true)
date_of_birth (string)  Date of birth of a Customer (applicable when is_private is true)
citizen_service_number (string)  Citizen service number (BSN-nummer) of a Customer (applicable when is_private is true)
attn (string)  To the attention of
phonenumber (string)  A Customer's phone number
website (string)  A Customer's website
email (string)  E-mail address to send the Invoice to
cc_emails (array[string])  An array of e-mail addresses to CC when the Invoice is sent
email_salutation (string)  Salutation used in the e-mail (template) when sending an Invoice
additional_information (string)  Extra Customer information
payment_term (integer)  Payment term for Invoices (in days, defaults to 30)
invoice_language (string)  The language in which the Invoice will be translated [nl|de|en|fr|es]
payment_method_invoice (string)  How the Invoice can be paid. [pay_later|direct_debit|already_paid]
reference (string)  Custom reference (for example the ID of a customer in an external CRM)
default_label_id (string)  Resource identifier (UUID) of the label to be set as default for a customer, which will a…
default_ledger_account_id (string)  Resource identifier (UUID) of the ledger account to be set as default for a customer, whi…
default_discount_description (string)  Description a default discount to apply to any invoices or estimates created for this cus…
default_discount_percentage (integer)  The default discount to apply expressed as a percentage
peppol_scheme_code (string)  Prefix describing the scheme of the peppol identifier.
peppol_identifier (integer)  Code used to identify a Peppol legal entity.
```

### customers update

`jortt customers update <customer-id>`

Update a customer (send the full customer: is_private and customer_name are required)

Calls `PUT /v3/customers/{customer_id}` (makes a plan).

- `--is-private <true|false>` Whether this Customer is a private person (true) or a company (false) (required)
- `--customer-name <value>` Either a company name (when is_private is false) or a private person's full name (when is_private i… (required)
- `--address-street <value>` Street and house number of the address of a Customer (required when is_private is false)
- `--address-postal-code <value>` Postal code of the address of a Customer (required when is_private is false)
- `--address-city <value>` City of the address of a Customer (required when is_private is false)
- `--address-country-code <value>` Country code of a Customer in ISO 3166-1 alpha-2 format (required when is_private is false, default…
- `--address-extra-information <value>` Extra line of Customer address information
- `--shift-vat <true|false>` Whether or not to shift the VAT for a Customer (applicable when is_private is false)
- `--vat-number <value>` The VAT number (BTW-nummer) of a Customer (applicable when is_private is false and shift_vat is tru…
- `--coc-number <value>` The Chamber of Commerce number (KvK-nummer) of a Customer (applicable when is_private is false)
- `--salutation <sir|madam|family>` The way a Customer is addressed (applicable when is_private is true)
- `--initials <value>` Initials of a Customer (applicable when is_private is true)
- `--first-name <value>` First name of a Customer (applicable when is_private is true)
- `--last-name <value>` Last name of a Customer (applicable when is_private is true)
- `--date-of-birth <value>` Date of birth of a Customer (applicable when is_private is true)
- `--citizen-service-number <value>` Citizen service number (BSN-nummer) of a Customer (applicable when is_private is true)
- `--attn <value>` To the attention of
- `--phonenumber <value>` A Customer's phone number
- `--website <value>` A Customer's website
- `--email <value>` E-mail address to send the Invoice to
- `--cc-emails <a,b,...>` An array of e-mail addresses to CC when the Invoice is sent
- `--email-salutation <value>` Salutation used in the e-mail (template) when sending an Invoice
- `--additional-information <value>` Extra Customer information
- `--payment-term <number>` Payment term for Invoices (in days, defaults to 30)
- `--invoice-language <nl|de|en|fr|es>` The language in which the Invoice will be translated
- `--payment-method-invoice <pay_later|direct_debit|already_paid>` How the Invoice can be paid.
- `--reference <value>` Custom reference (for example the ID of a customer in an external CRM)
- `--default-label-id <value>` Resource identifier (UUID) of the label to be set as default for a customer, which will automatical…
- `--default-ledger-account-id <value>` Resource identifier (UUID) of the ledger account to be set as default for a customer, which will au…
- `--default-discount-description <value>` Description a default discount to apply to any invoices or estimates created for this customer
- `--default-discount-percentage <number>` The default discount to apply expressed as a percentage
- `--peppol-scheme-code <value>` Prefix describing the scheme of the peppol identifier.
- `--peppol-identifier <number>` Code used to identify a Peppol legal entity.

Body fields:

```
is_private* (boolean)  Whether this Customer is a private person (true) or a company (false)
customer_name* (string)  Either a company name (when is_private is false) or a private person's full name (when is…
address_street (string)  Street and house number of the address of a Customer (required when is_private is false)
address_postal_code (string)  Postal code of the address of a Customer (required when is_private is false)
address_city (string)  City of the address of a Customer (required when is_private is false)
address_country_code (string)  Country code of a Customer in ISO 3166-1 alpha-2 format (required when is_private is fals…
address_extra_information (string)  Extra line of Customer address information
shift_vat (boolean)  Whether or not to shift the VAT for a Customer (applicable when is_private is false)
vat_number (string)  The VAT number (BTW-nummer) of a Customer (applicable when is_private is false and shift_…
coc_number (string)  The Chamber of Commerce number (KvK-nummer) of a Customer (applicable when is_private is …
salutation (string)  The way a Customer is addressed (applicable when is_private is true) [sir|madam|family]
initials (string)  Initials of a Customer (applicable when is_private is true)
first_name (string)  First name of a Customer (applicable when is_private is true)
last_name (string)  Last name of a Customer (applicable when is_private is true)
date_of_birth (string)  Date of birth of a Customer (applicable when is_private is true)
citizen_service_number (string)  Citizen service number (BSN-nummer) of a Customer (applicable when is_private is true)
attn (string)  To the attention of
phonenumber (string)  A Customer's phone number
website (string)  A Customer's website
email (string)  E-mail address to send the Invoice to
cc_emails (array[string])  An array of e-mail addresses to CC when the Invoice is sent
email_salutation (string)  Salutation used in the e-mail (template) when sending an Invoice
additional_information (string)  Extra Customer information
payment_term (integer)  Payment term for Invoices (in days, defaults to 30)
invoice_language (string)  The language in which the Invoice will be translated [nl|de|en|fr|es]
payment_method_invoice (string)  How the Invoice can be paid. [pay_later|direct_debit|already_paid]
reference (string)  Custom reference (for example the ID of a customer in an external CRM)
default_label_id (string)  Resource identifier (UUID) of the label to be set as default for a customer, which will a…
default_ledger_account_id (string)  Resource identifier (UUID) of the ledger account to be set as default for a customer, whi…
default_discount_description (string)  Description a default discount to apply to any invoices or estimates created for this cus…
default_discount_percentage (integer)  The default discount to apply expressed as a percentage
peppol_scheme_code (string)  Prefix describing the scheme of the peppol identifier.
peppol_identifier (integer)  Code used to identify a Peppol legal entity.
```

### customers delete

`jortt customers delete <customer-id>`

Delete a Customer

Calls `DELETE /v3/customers/{customer_id}` (makes a plan).

### customers archive

`jortt customers archive <customer-id>`

Archive a customer (--archived false to unarchive)

Calls `PUT /v3/customers/{customer_id}/set_archived` (makes a plan).

- `--archived <true|false>` Whether or not the item has been archived. (required)

Body fields:

```
archived* (boolean)  Whether or not the item has been archived.
```

### customers details

`jortt customers details <customer-id>`

Returns a Customer's details by ID

Calls `GET /v3/customers/{customer_id}/extra_details`.

### customers vat-percentages

`jortt customers vat-percentages <customer-id>`

Returns vat percentages that are valid on today's date for a Customer by ID

Calls `GET /v3/customers/{customer_id}/vat-percentages`.

### customers direct-debit

`jortt customers direct-debit <customer-id>`

Send direct debit authorization to a Customer

Calls `POST /v3/customers/{customer_id}/direct_debit_mandate` (makes a plan).

## invoices

Invoices: create, send, credit, download

### invoices list

`jortt invoices list`

Returns a list of Invoices

Calls `GET /v3/invoices`.

- `--query <value>` Search query (at least 3 characters)
- `--invoice-status <value>` invoice_status options [sent draft unpaid late paid]
- `--status <value>` Same as --invoice-status
- `--page <number>` Page to fetch (100 per page)
- `--all` Fetch every page (stops at --limit)

### invoices show

`jortt invoices show <invoice-id>`

Returns an Invoice by ID

Calls `GET /v3/invoices/{id}`.

### invoices create

`jortt invoices create`

Create a draft invoice (or create and send it, with send_method)

Calls `POST /v3/invoices` (makes a plan).

- `--customer-id <value>` Resource identifier (UUID)
- `--invoice-date <value>` Date of the Invoice (determines the VAT period)
- `--tradename-id <value>` The ID of the Tradename used for this Invoice.
- `--label-ids <a,b,...>` An array of label ids for example['e508ba44-f8a9-4aa9-b4e8-8d071a3454c4', 'c2ea9b6d-dc5f-4af0-b1ec-…
- `--delivery-period <value>` Determines the profit and loss period start date of this Invoice.
- `--delivery-period-end <value>` Determines the profit and loss period end date of this Invoice
- `--payment-term <number>` Optional payment term for the Invoice.
- `--net-amounts <true|false>` Whether or not VAT is included in the amount_per_unit in the line item (this is typically used when…
- `--send-method <email|peppol|self>` How the Invoice should be sent
- `--introduction <value>` Comments printed on the Invoice (above the line items)
- `--remarks <value>` Remarks printed on the Invoice (under the line items)
- `--payment-method <pay_later|direct_debit|already_paid>` How the Invoice can be paid.
- `--line-items <json>` The line items of an Invoice
- `--discounts <json>` Discounts applied to the invoice
- `--reference <value>` Custom reference (for example an order ID)
- `--sold-via-platform <true|false>` Whether or not an Invoice is marked as having goods that are sold via a platform such as Amazon
- `--attachment-ids <a,b,...>` The attachments to send with the invoice when a send_method is provided
- `--attachment-mime-types <a,b,...>` The MIME types of the attachments to send with the invoice
- `--purchase-reference <value>` Reference to the purchase order or invoice that this invoice is related to
- `--attachments <json>` The attachments to send with the invoice.

Body fields:

```
customer_id (string)  Resource identifier (UUID)
invoice_date (string)  Date of the Invoice (determines the VAT period)
tradename_id (string)  The ID of the Tradename used for this Invoice.
label_ids (array[string])  An array of label ids for example['e508ba44-f8a9-4aa9-b4e8-8d071a3454c4', 'c2ea9b6d-dc5f-…
delivery_period (string)  Determines the profit and loss period start date of this Invoice.
delivery_period_end (string)  Determines the profit and loss period end date of this Invoice
payment_term (integer)  Optional payment term for the Invoice.
net_amounts (boolean)  Whether or not VAT is included in the amount_per_unit in the line item (this is typically…
send_method (string)  How the Invoice should be sent [email|peppol|self]
introduction (string)  Comments printed on the Invoice (above the line items)
remarks (string)  Remarks printed on the Invoice (under the line items)
payment_method (string)  How the Invoice can be paid. [pay_later|direct_debit|already_paid]
line_items (array[object])  The line items of an Invoice
  description* (string)  Description of the line item
  quantity* (string)  A numeric string representing a quantity.
  amount* (object)
    amount* (string)
    currency* (string)  [EUR]
  vat* (object)
    value* (number)  A string representing vat percentage as a decimal
    category (string)  A string describing a vat category. [user_label|tradename_label|project_label]
  ledger_account_id (string)  Resource identifier (UUID) of the Ledger Account for this line_item.
discounts (array[object])  Discounts applied to the invoice
  description (string)  Description of the discount
  percentage* (integer)  The discount to apply expressed as a percentage
reference (string)  Custom reference (for example an order ID)
sold_via_platform (boolean)  Whether or not an Invoice is marked as having goods that are sold via a platform such as …
attachment_ids (array[string])  The attachments to send with the invoice when a send_method is provided
attachment_mime_types (array[string])  The MIME types of the attachments to send with the invoice
purchase_reference (string)  Reference to the purchase order or invoice that this invoice is related to
attachments (array[object])  The attachments to send with the invoice.
  id* (string)  The file id of the attachment
  name (string)  The display name of the attachment
```

### invoices update

`jortt invoices update <invoice-id>`

Edit an invoice that has not been sent yet

Calls `PUT /v3/invoices/{id}` (makes a plan).

- `--customer-id <value>` Resource identifier (UUID)
- `--invoice-date <value>` Date of the Invoice (determines the VAT period)
- `--tradename-id <value>` The ID of the Tradename used for this Invoice.
- `--label-ids <a,b,...>` An array of label ids for example['e508ba44-f8a9-4aa9-b4e8-8d071a3454c4', 'c2ea9b6d-dc5f-4af0-b1ec-…
- `--delivery-period <value>` Determines the profit and loss period start date of this Invoice.
- `--delivery-period-end <value>` Determines the profit and loss period end date of this Invoice
- `--payment-term <number>` Optional payment term for the Invoice.
- `--net-amounts <true|false>` Whether or not VAT is included in the amount_per_unit in the line item (this is typically used when…
- `--send-method <email|peppol|self>` How the Invoice should be sent
- `--introduction <value>` Comments printed on the Invoice (above the line items)
- `--remarks <value>` Remarks printed on the Invoice (under the line items)
- `--payment-method <pay_later|direct_debit|already_paid>` How the Invoice can be paid.
- `--line-items <json>` The line items of an Invoice
- `--discounts <json>` Discounts applied to the invoice
- `--reference <value>` Custom reference (for example an order ID)

Body fields:

```
customer_id (string)  Resource identifier (UUID)
invoice_date (string)  Date of the Invoice (determines the VAT period)
tradename_id (string)  The ID of the Tradename used for this Invoice.
label_ids (array[string])  An array of label ids for example['e508ba44-f8a9-4aa9-b4e8-8d071a3454c4', 'c2ea9b6d-dc5f-…
delivery_period (string)  Determines the profit and loss period start date of this Invoice.
delivery_period_end (string)  Determines the profit and loss period end date of this Invoice
payment_term (integer)  Optional payment term for the Invoice.
net_amounts (boolean)  Whether or not VAT is included in the amount_per_unit in the line item (this is typically…
send_method (string)  How the Invoice should be sent [email|peppol|self]
introduction (string)  Comments printed on the Invoice (above the line items)
remarks (string)  Remarks printed on the Invoice (under the line items)
payment_method (string)  How the Invoice can be paid. [pay_later|direct_debit|already_paid]
line_items (array[object])  The line items of an Invoice
  description (string)  Description of the line item
  quantity (string)  A numeric string representing a quantity.
  amount (object)
    amount* (string)
    currency* (string)  [EUR]
  vat (object)
    value* (number)  A string representing vat percentage as a decimal
    category (string)  A string describing a vat category. [user_label|tradename_label|project_label]
  ledger_account_id (string)  Resource identifier (UUID) of the Ledger Account for this line_item.
discounts (array[object])  Discounts applied to the invoice
  description (string)  Description of the discount
  percentage* (integer)  The discount to apply expressed as a percentage
reference (string)  Custom reference (for example an order ID)
```

### invoices delete

`jortt invoices delete <invoice-id>`

Delete an invoice

Calls `DELETE /v3/invoices/{id}` (makes a plan).

### invoices send

`jortt invoices send <invoice-id>`

Sends an Invoice

Calls `POST /v3/invoices/{id}/send` (makes a plan).

- `--send-method <email|peppol|self>` How the Invoice should be sent (required)
- `--email-address-customer <value>` The email address to send the invoice too.
- `--mail-subject <value>` Subject of the email that will be sent with the invoice.
- `--mail-body <value>` Body of the email that will be sent with the invoice.
- `--send-copy-to-me <true|false>` If true a copy of the invoice email will be sent to the users registered email.
- `--cc-addresses <a,b,...>` Extra email addresses to CC when sending the invoice by email.
- `--attachment-ids <a,b,...>` The attachments to send with the email
- `--attachment-mime-types <a,b,...>` The MIME types of the attachments to send with the email
- `--peppol-scheme-code <value>` The Code that described the given Peppol identifier.
- `--peppol-identifier <value>` The Peppol identifier of the recipient.
- `--attachments <json>` The attachments to send with the invoice.
- `--to <value>` Same as --email-address-customer
- `--subject <value>` Same as --mail-subject
- `--body <value>` Same as --mail-body

Body fields:

```
send_method* (string)  How the Invoice should be sent [email|peppol|self]
email_address_customer (string)  The email address to send the invoice too.
mail_subject (string)  Subject of the email that will be sent with the invoice.
mail_body (string)  Body of the email that will be sent with the invoice.
send_copy_to_me (boolean)  If true a copy of the invoice email will be sent to the users registered email.
cc_addresses (array[string])  Extra email addresses to CC when sending the invoice by email.
attachment_ids (array[string])  The attachments to send with the email
attachment_mime_types (array[string])  The MIME types of the attachments to send with the email
peppol_scheme_code (string)  The Code that described the given Peppol identifier.
peppol_identifier (string)  The Peppol identifier of the recipient.
attachments (array[object])  The attachments to send with the invoice.
  id* (string)  The file id of the attachment
  name (string)  The display name of the attachment
```

### invoices credit

`jortt invoices credit <invoice-id>`

Create a credit invoice for an invoice

Calls `POST /v3/invoices/{id}/credit` (makes a plan).

- `--send-method <email|peppol|self>` How the Invoice should be sent

Body fields:

```
send_method (string)  How the Invoice should be sent [email|peppol|self]
```

### invoices copy

`jortt invoices copy <invoice-id>`

Copy an invoice into a new draft

Calls `POST /v3/invoices/{id}/copy` (makes a plan).

### invoices set-labels

`jortt invoices set-labels <invoice-id>`

Sets the labels for a given invoice

Calls `PUT /v3/invoices/{id}/set_labels` (makes a plan).

- `--label-ids <a,b,...>` An array of label ids for example['e508ba44-f8a9-4aa9-b4e8-8d071a3454c4', 'c2ea9b6d-dc5f-4af0-b1ec-… (required)

Body fields:

```
label_ids* (array[string])  An array of label ids for example['e508ba44-f8a9-4aa9-b4e8-8d071a3454c4', 'c2ea9b6d-dc5f-…
```

### invoices download

`jortt invoices download <invoice-id>`

Get the PDF download link (add --out file.pdf to save it)

Calls `GET /v3/invoices/{id}/download`.

- `--out <file>` Save the file behind the download link here

### invoices next-number

`jortt invoices next-number <invoice-id>`

Returns the next possible invoice number

Calls `GET /v3/invoices/{id}/next_possible_invoice_number`.

### invoices send-settings

`jortt invoices send-settings <invoice-id>`

Returns the current send settings for the invoice

Calls `GET /v3/invoices/{id}/send_settings`.

### invoices line-item-suggestions

`jortt invoices line-item-suggestions <invoice-id>`

Returns a list of suggested line items

Calls `GET /v3/invoices/{id}/line_item_suggestions`.

- `--query <value>` Query string to search for suggestions with (required)

### invoices payment-ledger-accounts

`jortt invoices payment-ledger-accounts <invoice-id>`

List Payment Method Ledger Accounts of an Invoice

Calls `GET /v3/invoices/{id}/payment_methods/ledger_accounts`.

### invoices payment-sources

`jortt invoices payment-sources <invoice-id>`

List Payment Method Sources of an Invoice

Calls `GET /v3/invoices/{id}/payment_methods/sources`.

- `--page <number>` Page to fetch (100 per page)
- `--all` Fetch every page (stops at --limit)

### invoices peppol-schemes

`jortt invoices peppol-schemes`

Returns valid peppol scheme options by country code

Calls `GET /v3/invoices/peppol-scheme-catalog`.

## estimates

Estimates (quotes / offertes)

### estimates list

`jortt estimates list`

Returns a list of Estimates

Calls `GET /v3/estimates`.

- `--query <value>` query
- `--estimate-status <value>` estimate_status
- `--acceptance-status <value>` acceptance_status
- `--status <value>` Same as --estimate-status
- `--page <number>` Page to fetch (100 per page)
- `--all` Fetch every page (stops at --limit)

### estimates show

`jortt estimates show <estimate-id>`

Returns an Estimate by ID

Calls `GET /v3/estimates/{id}`.

### estimates create

`jortt estimates create`

Create an estimate (or create and send it, with send_method)

Calls `POST /v3/estimates` (makes a plan).

- `--customer-id <value>` Resource identifier (UUID)
- `--tradename-id <value>` The ID of the Tradename used for this Invoice.
- `--valid-until <value>` The date until which the Estimate is valid.
- `--net-amounts <true|false>` Whether or not VAT is included in the amount_per_unit in the line item (this is typically used when…
- `--send-method <email|peppol|self>` How the Invoice should be sent
- `--email-address-customer <value>` The email address to send the estimate to.
- `--introduction <value>` Comments printed on the Invoice (above the line items)
- `--remarks <value>` Remarks printed on the Invoice (under the line items)
- `--reference <value>` Custom reference (for example an order ID)
- `--line-items <json>` The line items of an Invoice
- `--discounts <json>` Discounts applied to the invoice
- `--attachment-ids <a,b,...>` The attachments to send with the estimate email
- `--attachment-mime-types <a,b,...>` The MIME types of the attachments to send with the estimate email
- `--attachments <json>` The attachments to send with the estimate email.

Body fields:

```
customer_id (string)  Resource identifier (UUID)
tradename_id (string)  The ID of the Tradename used for this Invoice.
valid_until (string)  The date until which the Estimate is valid.
net_amounts (boolean)  Whether or not VAT is included in the amount_per_unit in the line item (this is typically…
send_method (string)  How the Invoice should be sent [email|peppol|self]
email_address_customer (string)  The email address to send the estimate to.
introduction (string)  Comments printed on the Invoice (above the line items)
remarks (string)  Remarks printed on the Invoice (under the line items)
reference (string)  Custom reference (for example an order ID)
line_items (array[object])  The line items of an Invoice
  description* (string)  Description of the line item
  quantity* (string)  A numeric string representing a quantity.
  amount* (object)
    amount* (string)
    currency* (string)  [EUR]
  vat* (object)
    value* (number)  A string representing vat percentage as a decimal
    category (string)  A string describing a vat category. [user_label|tradename_label|project_label]
discounts (array[object])  Discounts applied to the invoice
  description (string)  Description of the discount
  percentage* (integer)  The discount to apply expressed as a percentage
attachment_ids (array[string])  The attachments to send with the estimate email
attachment_mime_types (array[string])  The MIME types of the attachments to send with the estimate email
attachments (array[object])  The attachments to send with the estimate email.
  id* (string)  The file id of the attachment
  name (string)  The display name of the attachment
```

### estimates update

`jortt estimates update <estimate-id>`

Edits an Estimate

Calls `PUT /v3/estimates/{id}` (makes a plan).

- `--customer-id <value>` Resource identifier (UUID)
- `--tradename-id <value>` The ID of the Tradename used for this Invoice.
- `--valid-until <value>` The date until which the Estimate is valid.
- `--net-amounts <true|false>` Whether or not VAT is included in the amount_per_unit in the line item (this is typically used when…
- `--introduction <value>` Comments printed on the Invoice (above the line items)
- `--remarks <value>` Remarks printed on the Invoice (under the line items)
- `--reference <value>` Custom reference (for example an order ID)
- `--line-items <json>` The line items of an Invoice
- `--discounts <json>` Discounts applied to the invoice

Body fields:

```
customer_id (string)  Resource identifier (UUID)
tradename_id (string)  The ID of the Tradename used for this Invoice.
valid_until (string)  The date until which the Estimate is valid.
net_amounts (boolean)  Whether or not VAT is included in the amount_per_unit in the line item (this is typically…
introduction (string)  Comments printed on the Invoice (above the line items)
remarks (string)  Remarks printed on the Invoice (under the line items)
reference (string)  Custom reference (for example an order ID)
line_items (array[object])  The line items of an Invoice
  description (string)  Description of the line item
  quantity (string)  A numeric string representing a quantity.
  amount (object)
    amount* (string)
    currency* (string)  [EUR]
  vat (object)
    value* (number)  A string representing vat percentage as a decimal
    category (string)  A string describing a vat category. [user_label|tradename_label|project_label]
discounts (array[object])  Discounts applied to the invoice
  description (string)  Description of the discount
  percentage* (integer)  The discount to apply expressed as a percentage
```

### estimates delete

`jortt estimates delete <estimate-id>`

Deletes an Estimate

Calls `DELETE /v3/estimates/{id}` (makes a plan).

### estimates send

`jortt estimates send <estimate-id>`

Sends an Estimate

Calls `POST /v3/estimates/{id}/send` (makes a plan).

- `--send-method <email|peppol|self>` How the Invoice should be sent (required)
- `--email-address-customer <value>` The email address to send the estimate to.
- `--attachment-ids <a,b,...>` The attachments to send with the estimate email
- `--attachment-mime-types <a,b,...>` The MIME types of the attachments to send with the estimate email
- `--attachments <json>` The attachments to send with the estimate email.
- `--to <value>` Same as --email-address-customer

Body fields:

```
send_method* (string)  How the Invoice should be sent [email|peppol|self]
email_address_customer (string)  The email address to send the estimate to.
attachment_ids (array[string])  The attachments to send with the estimate email
attachment_mime_types (array[string])  The MIME types of the attachments to send with the estimate email
attachments (array[object])  The attachments to send with the estimate email.
  id* (string)  The file id of the attachment
  name (string)  The display name of the attachment
```

### estimates accept

`jortt estimates accept <estimate-id>`

Accepts an Estimate

Calls `POST /v3/estimates/{id}/accept` (makes a plan).

### estimates reject

`jortt estimates reject <estimate-id>`

Rejects an Estimate

Calls `POST /v3/estimates/{id}/reject` (makes a plan).

- `--comment <value>` Optional rejection comment

Body fields:

```
comment (string)  Optional rejection comment
```

### estimates copy

`jortt estimates copy <estimate-id>`

Creates a copy of an Estimate

Calls `POST /v3/estimates/{id}/copy` (makes a plan).

### estimates to-invoice

`jortt estimates to-invoice <estimate-id>`

Creates an Invoice from an Estimate

Calls `POST /v3/estimates/{id}/invoice` (makes a plan).

### estimates download

`jortt estimates download <estimate-id>`

Get the PDF download link (add --out file.pdf to save it)

Calls `GET /v3/estimates/{id}/download`.

- `--out <file>` Save the file behind the download link here

### estimates send-settings

`jortt estimates send-settings <estimate-id>`

Returns the current send settings for the estimate

Calls `GET /v3/estimates/{id}/send_settings`.

### estimates line-item-suggestions

`jortt estimates line-item-suggestions <estimate-id>`

Returns a list of suggested line items

Calls `GET /v3/estimates/{id}/line_item_suggestions`.

- `--query <value>` Query string to search for suggestions with (required)

## expenses

Expenses (costs, income and balance bookings)

### expenses list

`jortt expenses list`

List Expenses

Calls `GET /v3/expenses`.

- `--vat-date-from <value>` Filter expenses with vat_date on or after this date
- `--vat-date-till <value>` Filter expenses with vat_date on or before this date
- `--delivery-date-from <value>` Filter expenses with delivery_period on or after this date
- `--delivery-date-till <value>` Filter expenses with delivery_period on or before this date
- `--expense-type <cost|income|balance>` Filter by expense type
- `--type <cost|income|balance>` Same as --expense-type
- `--page <number>` Page to fetch (100 per page)
- `--all` Fetch every page (stops at --limit)

### expenses show

`jortt expenses show <expense-id>`

Get Expense by ID

Calls `GET /v3/expenses/id/{id}`.

### expenses create

`jortt expenses create`

Create an Expense

Calls `POST /v3/expenses` (makes a plan).

- `--approved <true|false>` Whether the expense is approved
- `--description <value>` Description of the expense (required)
- `--ledger-account-id <value>` Ledger account identifier (required)
- `--expense-type <cost|income|balance>` Type of expense. (required)
- `--vat-date <value>` VAT date of the expense (required)
- `--delivery-period <value>` Delivery period start date (required for cost and income) (required)
- `--delivery-period-end <value>` Delivery period end date
- `--vat-type <value>` VAT type of the expense (required)
- `--raw-total-amount <json>` raw_total_amount (required)
- `--vat-line-items <json>` VAT line items
- `--label-ids <a,b,...>` The ids from GET /labels.

Body fields:

```
approved (boolean)  Whether the expense is approved
description* (string)  Description of the expense
ledger_account_id* (string)  Ledger account identifier
expense_type* (string)  Type of expense. [cost|income|balance]
vat_date* (string)  VAT date of the expense
delivery_period* (string)  Delivery period start date (required for cost and income)
delivery_period_end (string)  Delivery period end date
vat_type* (string)  VAT type of the expense [btw_type_leverancier_uit_nl|btw_type_leverancier_uit_nl_btw_verlegd|btw_type_leverancier_binnen_eu|btw_type_leverancier_binnen_eu_btw_verlegd|btw_type_leverancier_buiten_eu|btw_type_leverancier_buiten_eu_btw_verlegd|btw_type_particulier_binnen_de_eu_margeregeling_hoog|btw_type_leverancier_reisproduct_reisbureauregeling_hoog]
raw_total_amount* (object)
  amount* (string)
  currency* (string)  [EUR]
vat_line_items (array[object])  VAT line items
  vat (object)
    value* (number)  A string representing vat percentage as a decimal
    category (string)  A string describing a vat category. [user_label|tradename_label|project_label]
  vat_amount* (object)
    amount* (string)
    currency* (string)  [EUR]
label_ids (array[string])  The ids from GET /labels.
```

### expenses update

`jortt expenses update <expense-id>`

Update an Expense

Calls `POST /v3/expenses/id/{id}` (makes a plan).

- `--approved <true|false>` Whether the expense is approved
- `--description <value>` Description of the expense (required)
- `--ledger-account-id <value>` Ledger account identifier (required)
- `--expense-type <cost|income|balance>` Type of expense. (required)
- `--vat-date <value>` VAT date of the expense (required)
- `--delivery-period <value>` Delivery period start date (required for cost and income) (required)
- `--delivery-period-end <value>` Delivery period end date
- `--vat-type <value>` VAT type of the expense (required)
- `--raw-total-amount <json>` raw_total_amount (required)
- `--vat-line-items <json>` VAT line items
- `--label-ids <a,b,...>` The ids from GET /labels.

Body fields:

```
approved (boolean)  Whether the expense is approved
description* (string)  Description of the expense
ledger_account_id* (string)  Ledger account identifier
expense_type* (string)  Type of expense. [cost|income|balance]
vat_date* (string)  VAT date of the expense
delivery_period* (string)  Delivery period start date (required for cost and income)
delivery_period_end (string)  Delivery period end date
vat_type* (string)  VAT type of the expense [btw_type_leverancier_uit_nl|btw_type_leverancier_uit_nl_btw_verlegd|btw_type_leverancier_binnen_eu|btw_type_leverancier_binnen_eu_btw_verlegd|btw_type_leverancier_buiten_eu|btw_type_leverancier_buiten_eu_btw_verlegd|btw_type_particulier_binnen_de_eu_margeregeling_hoog|btw_type_leverancier_reisproduct_reisbureauregeling_hoog]
raw_total_amount* (object)
  amount* (string)
  currency* (string)  [EUR]
vat_line_items (array[object])  VAT line items
  vat (object)
    value* (number)  A string representing vat percentage as a decimal
    category (string)  A string describing a vat category. [user_label|tradename_label|project_label]
  vat_amount* (object)
    amount* (string)
    currency* (string)  [EUR]
label_ids (array[string])  The ids from GET /labels.
```

### expenses delete

`jortt expenses delete <expense-id>`

Delete an Expense

Calls `DELETE /v3/expenses/id/{id}` (makes a plan).

- `--force <true|false>` Also delete the expense when it is approved

### expenses attach-receipt

`jortt expenses attach-receipt <expense-id>`

Attach a Receipt to an Expense

Calls `POST /v3/expenses/id/{id}/receipt` (makes a plan).

- `--receipt-id <value>` Receipt identifier (UUID) (required)

Body fields:

```
receipt_id* (string)  Receipt identifier (UUID)
```

### expenses payment-ledger-accounts

`jortt expenses payment-ledger-accounts <expense-id>`

List Payment Method Ledger Accounts of an Expense

Calls `GET /v3/expenses/id/{id}/payment_methods/ledger_accounts`.

### expenses payment-sources

`jortt expenses payment-sources <expense-id>`

List Payment Method Sources of an Expense

Calls `GET /v3/expenses/id/{id}/payment_methods/sources`.

- `--page <number>` Page to fetch (100 per page)
- `--all` Fetch every page (stops at --limit)

## projects

Projects and their hour/cost registrations (line items)

### projects list

`jortt projects list`

Returns a list of Projects

Calls `GET /v3/projects`.

- `--page <number>` Page to fetch (100 per page)
- `--all` Fetch every page (stops at --limit)

### projects show

`jortt projects show <project-id>`

Returns a Project

Calls `GET /v3/projects/{id}`.

### projects create

`jortt projects create`

Creates a Project

Calls `POST /v3/projects` (makes a plan).

- `--name <value>` The name of the project. (required)
- `--description <value>` A string describing the project.
- `--reference <value>` Custom reference (for example an order ID)
- `--is-internal <true|false>` Whether or not the project is an internal project.
- `--default-registration-description <value>` A string that can be used to prefill project registrations.
- `--default-hourly-rate <json>` default_hourly_rate
- `--customer-id <value>` Resource identifier (UUID) for the project customer.

Body fields:

```
name* (string)  The name of the project.
description (string)  A string describing the project.
reference (string)  Custom reference (for example an order ID)
is_internal (boolean)  Whether or not the project is an internal project.
default_registration_description (string)  A string that can be used to prefill project registrations.
default_hourly_rate (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
customer_id (string)  Resource identifier (UUID) for the project customer.
```

### projects update

`jortt projects update <project-id>`

Updates a Project

Calls `PUT /v3/projects/{id}` (makes a plan).

- `--name <value>` The name of the project.
- `--description <value>` A string describing the project.
- `--reference <value>` Custom reference (for example an order ID)
- `--is-internal <true|false>` Whether or not the project is an internal project.
- `--default-registration-description <value>` A string that can be used to prefill project registrations.
- `--default-hourly-rate <json>` default_hourly_rate
- `--customer-id <value>` Resource identifier (UUID) for the project customer.

Body fields:

```
name (string)  The name of the project.
description (string)  A string describing the project.
reference (string)  Custom reference (for example an order ID)
is_internal (boolean)  Whether or not the project is an internal project.
default_registration_description (string)  A string that can be used to prefill project registrations.
default_hourly_rate (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
customer_id (string)  Resource identifier (UUID) for the project customer.
```

### projects delete

`jortt projects delete <project-id>`

Deletes a Project

Calls `DELETE /v3/projects/{id}` (makes a plan).

### projects invoice

`jortt projects invoice <project-id>`

Create an invoice from project line items

Calls `POST /v3/projects/{id}/invoice` (makes a plan).

- `--line-item-ids <a,b,...>` An array of line item ids to be invoiced (required)
- `--days <a,b,...>` An array of dates on which all invoiceable line items will be invoiced
- `--months <a,b,...>` An array of months for which all invoicable line items will be invoiced

Body fields:

```
line_item_ids* (array[string])  An array of line item ids to be invoiced
days (array[string])  An array of dates on which all invoiceable line items will be invoiced
months (array[string])  An array of months for which all invoicable line items will be invoiced
```

### projects line-items

line-items commands

#### projects line-items list

`jortt projects line-items list <project-id>`

Returns a list of Project Line Items

Calls `GET /v3/projects/{id}/line_items`.

- `--start-date <value>` date to fetch data from (inclusive)
- `--end-date <value>` date to fetch data until (exclusive)
- `--status-filter <billable|invoiced|concept|nonbillable>` status used to filter project line items
- `--page <number>` Page to fetch (100 per page)
- `--all` Fetch every page (stops at --limit)

#### projects line-items show

`jortt projects line-items show <project-id> <line-item-id>`

Returns a Project Line Item

Calls `GET /v3/projects/{id}/line_items/{line_item_id}`.

#### projects line-items create

`jortt projects line-items create <project-id>`

Creates a Project Line Item

Calls `POST /v3/projects/{id}/line_items` (makes a plan).

- `--description <value>` A string describing line item.
- `--date <value>` The date that the line item was logged on.
- `--amount <json>` amount
- `--status <billable|invoiced|concept|nonbillable>` String indicating the line item's billing status.
- `--line-item-type <value>` String representing the type of line item this is, can either be time_registration or cost.
- `--quantity <json>` Quantity for this time registration.
- `--minutes <number>` Minutes for this time registration.
- `--user-id <value>` ID for the user associated with this line item.

Body fields:

```
description (string)  A string describing line item.
date (string)  The date that the line item was logged on.
amount (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
status (string)  String indicating the line item's billing status. [billable|invoiced|concept|nonbillable]
line_item_type (string)  String representing the type of line item this is, can either be time_registration or cos…
quantity (object)  Quantity for this time registration.
minutes (integer)  Minutes for this time registration.
user_id (string)  ID for the user associated with this line item.
```

#### projects line-items update

`jortt projects line-items update <project-id> <line-item-id>`

Updates a Project Line item

Calls `PUT /v3/projects/{id}/line_items/{line_item_id}` (makes a plan).

- `--description <value>` A string describing line item.
- `--date <value>` The date that the line item was logged on.
- `--amount <json>` amount
- `--status <billable|invoiced|concept|nonbillable>` String indicating the line item's billing status.
- `--line-item-type <value>` String representing the type of line item this is, can either be time_registration or cost.
- `--quantity <json>` Quantity for this time registration.
- `--minutes <number>` Minutes for this time registration.
- `--user-id <value>` ID for the user associated with this line item.

Body fields:

```
description (string)  A string describing line item.
date (string)  The date that the line item was logged on.
amount (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
status (string)  String indicating the line item's billing status. [billable|invoiced|concept|nonbillable]
line_item_type (string)  String representing the type of line item this is, can either be time_registration or cos…
quantity (object)  Quantity for this time registration.
minutes (integer)  Minutes for this time registration.
user_id (string)  ID for the user associated with this line item.
```

#### projects line-items delete

`jortt projects line-items delete <project-id> <line-item-id>`

Deletes a Project Line item

Calls `DELETE /v3/projects/{id}/line_items/{line_item_id}` (makes a plan).

#### projects line-items summary

`jortt projects line-items summary <project-id>`

Returns a list of Project Line Item summaries

Calls `GET /v3/projects/{id}/line_items/summary`.

- `--period <value>` period of the summaries you wish to fetch.
- `--start-date <value>` date to fetch data from (inclusive)
- `--end-date <value>` date to fetch data until (inclusive)

## labels

Labels for invoices and bookings

### labels list

`jortt labels list`

Returns a list of labels

Calls `GET /v3/labels`.

### labels create

`jortt labels create`

Create a label

Calls `POST /v3/labels` (makes a plan).

- `--description <value>` The description of a Label (required)

Body fields:

```
description* (string)  The description of a Label
```

## ledger-accounts

Ledger accounts (grootboekrekeningen) to book on

### ledger-accounts invoices

`jortt ledger-accounts invoices`

Ledger accounts for invoice line items

Calls `GET /v3/ledger_accounts/invoices`.

### ledger-accounts invoice-default

`jortt ledger-accounts invoice-default`

Returns the default Ledger Account that can be used to categorize Line Items.

Calls `GET /v3/ledger_accounts/invoices/default`.

### ledger-accounts cost

`jortt ledger-accounts cost`

Ledger accounts for expenses of type cost

Calls `GET /v3/ledger_accounts/expenses/cost`.

### ledger-accounts income

`jortt ledger-accounts income`

Ledger accounts for expenses of type income

Calls `GET /v3/ledger_accounts/expenses/income`.

### ledger-accounts balance

`jortt ledger-accounts balance`

Ledger accounts for expenses of type balance

Calls `GET /v3/ledger_accounts/expenses/balance`.

## payroll

Payroll journal entries (loonjournaalposten)

### payroll list

`jortt payroll list`

Returns a list of Loonjournaalposten

Calls `GET /v3/loonjournaalposten`.

- `--year <value>` The year to get the Loonjournaalposten for

### payroll create

`jortt payroll create`

Create a Loonjournaalpost

Calls `POST /v3/loonjournaalposten` (makes a plan).

- `--period-date <value>` Date of the Loonjournaalpost period, must be the first day of the month (required)
- `--bruto-loon <json>` bruto_loon
- `--werkgeversdeel-sociale-lasten <json>` werkgeversdeel_sociale_lasten
- `--werkgeversdeel-pensioenkosten <json>` werkgeversdeel_pensioenkosten
- `--reservering-vakantiegeld <json>` reservering_vakantiegeld
- `--reservering-eindejaarsuitkering <json>` reservering_eindejaarsuitkering
- `--onbelaste-reiskostenvergoedingen <json>` onbelaste_reiskostenvergoedingen
- `--onbelaste-vergoedingen-gericht-vrijgesteld <json>` onbelaste_vergoedingen_gericht_vrijgesteld
- `--onbelaste-vergoedingen-wkr <json>` onbelaste_vergoedingen_wkr
- `--declaraties-algemeen <json>` declaraties_algemeen
- `--declaraties-kantoorkosten <json>` declaraties_kantoorkosten
- `--declaraties-lunch-en-diner-representatiekosten <json>` declaraties_lunch_en_diner_representatiekosten
- `--declaraties-reiskosten <json>` declaraties_reiskosten
- `--declaraties-auto-en-transportkosten <json>` declaraties_auto_en_transportkosten
- `--declaraties-verkoopkosten <json>` declaraties_verkoopkosten
- `--eindheffing-wkr <json>` eindheffing_wkr
- `--netto-inhoudingen <json>` netto_inhoudingen
- `--afdrachtvermindering-speur-en-ontwikkelingswerk <json>` afdrachtvermindering_speur_en_ontwikkelingswerk
- `--te-betalen-nettolonen <json>` te_betalen_nettolonen
- `--te-betalen-sociale-lasten-loonbelasting <json>` te_betalen_sociale_lasten_loonbelasting
- `--te-betalen-pensioenpremies <json>` te_betalen_pensioenpremies
- `--te-betalen-vakantiegeld <json>` te_betalen_vakantiegeld
- `--te-betalen-eindejaarsuitkering <json>` te_betalen_eindejaarsuitkering
- `--te-betalen-loonbeslag <json>` te_betalen_loonbeslag

Body fields:

```
period_date* (string)  Date of the Loonjournaalpost period, must be the first day of the month
bruto_loon (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
werkgeversdeel_sociale_lasten (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
werkgeversdeel_pensioenkosten (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
reservering_vakantiegeld (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
reservering_eindejaarsuitkering (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
onbelaste_reiskostenvergoedingen (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
onbelaste_vergoedingen_gericht_vrijgesteld (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
onbelaste_vergoedingen_wkr (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
declaraties_algemeen (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
declaraties_kantoorkosten (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
declaraties_lunch_en_diner_representatiekosten (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
declaraties_reiskosten (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
declaraties_auto_en_transportkosten (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
declaraties_verkoopkosten (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
eindheffing_wkr (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
netto_inhoudingen (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
afdrachtvermindering_speur_en_ontwikkelingswerk (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
te_betalen_nettolonen (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
te_betalen_sociale_lasten_loonbelasting (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
te_betalen_pensioenpremies (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
te_betalen_vakantiegeld (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
te_betalen_eindejaarsuitkering (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
te_betalen_loonbeslag (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
```

### payroll update

`jortt payroll update <entry-id>`

Update a Loonjournaalpost

Calls `PUT /v3/loonjournaalposten/{loonjournaalpost_id}` (makes a plan).

- `--bruto-loon <json>` bruto_loon
- `--werkgeversdeel-sociale-lasten <json>` werkgeversdeel_sociale_lasten
- `--werkgeversdeel-pensioenkosten <json>` werkgeversdeel_pensioenkosten
- `--reservering-vakantiegeld <json>` reservering_vakantiegeld
- `--reservering-eindejaarsuitkering <json>` reservering_eindejaarsuitkering
- `--onbelaste-reiskostenvergoedingen <json>` onbelaste_reiskostenvergoedingen
- `--onbelaste-vergoedingen-gericht-vrijgesteld <json>` onbelaste_vergoedingen_gericht_vrijgesteld
- `--onbelaste-vergoedingen-wkr <json>` onbelaste_vergoedingen_wkr
- `--declaraties-algemeen <json>` declaraties_algemeen
- `--declaraties-kantoorkosten <json>` declaraties_kantoorkosten
- `--declaraties-lunch-en-diner-representatiekosten <json>` declaraties_lunch_en_diner_representatiekosten
- `--declaraties-reiskosten <json>` declaraties_reiskosten
- `--declaraties-auto-en-transportkosten <json>` declaraties_auto_en_transportkosten
- `--declaraties-verkoopkosten <json>` declaraties_verkoopkosten
- `--eindheffing-wkr <json>` eindheffing_wkr
- `--netto-inhoudingen <json>` netto_inhoudingen
- `--afdrachtvermindering-speur-en-ontwikkelingswerk <json>` afdrachtvermindering_speur_en_ontwikkelingswerk
- `--te-betalen-nettolonen <json>` te_betalen_nettolonen
- `--te-betalen-sociale-lasten-loonbelasting <json>` te_betalen_sociale_lasten_loonbelasting
- `--te-betalen-pensioenpremies <json>` te_betalen_pensioenpremies
- `--te-betalen-vakantiegeld <json>` te_betalen_vakantiegeld
- `--te-betalen-eindejaarsuitkering <json>` te_betalen_eindejaarsuitkering
- `--te-betalen-loonbeslag <json>` te_betalen_loonbeslag

Body fields:

```
bruto_loon (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
werkgeversdeel_sociale_lasten (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
werkgeversdeel_pensioenkosten (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
reservering_vakantiegeld (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
reservering_eindejaarsuitkering (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
onbelaste_reiskostenvergoedingen (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
onbelaste_vergoedingen_gericht_vrijgesteld (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
onbelaste_vergoedingen_wkr (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
declaraties_algemeen (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
declaraties_kantoorkosten (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
declaraties_lunch_en_diner_representatiekosten (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
declaraties_reiskosten (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
declaraties_auto_en_transportkosten (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
declaraties_verkoopkosten (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
eindheffing_wkr (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
netto_inhoudingen (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
afdrachtvermindering_speur_en_ontwikkelingswerk (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
te_betalen_nettolonen (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
te_betalen_sociale_lasten_loonbelasting (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
te_betalen_pensioenpremies (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
te_betalen_vakantiegeld (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
te_betalen_eindejaarsuitkering (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
te_betalen_loonbeslag (object)
  value* (number)  Amount per unit of the line item
  currency* (string)  Currency of the line item [EUR]
```

### payroll delete

`jortt payroll delete <entry-id>`

Delete a Loonjournaalpost

Calls `DELETE /v3/loonjournaalposten/{loonjournaalpost_id}` (makes a plan).

## organizations

The administration(s) these credentials act on

### organizations me

`jortt organizations me`

The administration these credentials act on

Calls `GET /v3/organizations/me`.

### organizations list

`jortt organizations list`

List the organizations the api credentials may act on

Calls `GET /v3/organizations`.

## tradenames

Trade names (handelsnamen)

### tradenames list

`jortt tradenames list`

Returns a list of tradenames

Calls `GET /v3/tradenames`.

## inbox

Upload receipts to the Jortt inbox

### inbox upload

`jortt inbox upload <files...>`

Upload receipt images to the inbox

Calls `POST /v3/inbox/images` (makes a plan).

- `--images <a,b,...>` An array of base64 encoded images (required)

Body fields:

```
images* (array[string])  An array of base64 encoded images
```

## reports

Profit & loss, balance and dashboard summaries

### reports profit-and-loss

`jortt reports profit-and-loss`  (alias: pnl)

Profit and Loss Report

Calls `GET /v3/reports/profit-and-loss`.

- `--year <number>` Calendar year of the reporting period, from 2006 up to and including next year (required)
- `--quarter <number>` Narrow the period down to a quarter
- `--month <number>` Narrow the period down to a month
- `--label-ids <a,b,...>` Only include bookings carrying one of these labels, as returned by GET /labels
- `--labels <a,b,...>` Same as --label-ids

### reports balance

`jortt reports balance`

Balance Report

Calls `GET /v3/reports/balance`.

- `--year <number>` Calendar year of the reporting period, from 2006 up to and including next year (required)
- `--quarter <number>` Narrow the period down to a quarter
- `--month <number>` Narrow the period down to a month

### reports summary

summary commands

#### reports summary invoices

`jortt reports summary invoices`

Returns a summary of invoices for the current year

Calls `GET /v3/reports/summaries/invoices`.

#### reports summary btw

`jortt reports summary btw`  (alias: vat)

Returns a list of summarized btw periods

Calls `GET /v3/reports/summaries/btw`.

#### reports summary balance

`jortt reports summary balance`

Returns key organization balances for the current date

Calls `GET /v3/reports/summaries/balance`.

#### reports summary profit-and-loss

`jortt reports summary profit-and-loss`  (alias: pnl)

Returns a summary of profit and loss for the current year

Calls `GET /v3/reports/summaries/profit_and_loss`.

#### reports summary cash-and-bank

`jortt reports summary cash-and-bank`  (alias: cash)

Returns a summary of bank accounts, cash and liquid assets

Calls `GET /v3/reports/summaries/cash_and_bank`.

## files

Attachments for invoices and estimates

### files upload

`jortt files upload <file>`

Upload a file as an attachment (id is generated when not given)

Calls `POST /v3/files/attachment_upload` (makes a plan).

- `--id <value>` Resource identifier (UUID) (required)
- `--name <value>` The name of the attachment (required)
- `--mime-type <value>` The MIME type of the attachment (required)
- `--contents <value>` The base64 encoded contents of the attachment (required)

Body fields:

```
id* (string)  Resource identifier (UUID)
name* (string)  The name of the attachment
mime_type* (string)  The MIME type of the attachment [image/bmp|image/x-windows-bmp|image/gif|image/jpeg|image/jpg|image/pjpeg|image/png|image/x-png|application/pdf|image/tif|image/x-tif|image/tiff|image/x-tiff|application/tif|application/x-tif|application/tiff|application/x-tiff|application/msword|application/vnd.openxmlformats-officedocument.wordprocessingml.document|application/vnd.ms-excel|application/vnd.openxmlformats-officedocument.spreadsheetml.sheet]
contents* (string)  The base64 encoded contents of the attachment
```

### files download-url

`jortt files download-url`

Request a download URL for an attachment

Calls `GET /v3/files/attachment_download`.

- `--id <value>` Resource identifier (UUID) (required)
- `--name <value>` The file name used when downloading the attachment

### files upload-url

`jortt files upload-url`

Request an upload URL for attachments

Calls `GET /v3/files/put_url`.

- `--id <value>` Resource identifier (UUID) (required)
- `--name <value>` The name of the file to be uploaded (required)
- `--mime-type <value>` The MIME type of the file to be uploaded (required)
- `--content-length <number>` The content length of the file to be uploaded (required)

## bank

Bank accounts and transactions

### bank accounts

`jortt bank accounts`

List all Bank Accounts

Calls `GET /v3/bank-accounts`.

### bank transactions

`jortt bank transactions <bank-account-id>`

List Bank Transactions for a Bank Account

Calls `GET /v3/bank-accounts/{id}/bank-transactions`.

- `--page <number>` Page to fetch (100 per page)
- `--all` Fetch every page (stops at --limit)

### bank transaction-sources

`jortt bank transaction-sources <bank-account-id> <transaction-id>`

List Payment Method Sources of a Bank Transaction

Calls `GET /v3/bank-accounts/{id}/bank-transactions/{transaction_id}/payment_methods/sources`.

- `--page <number>` Page to fetch (100 per page)
- `--all` Fetch every page (stops at --limit)

## payments

Register and list payments on invoices and expenses

### payments list

`jortt payments list <sink-id>`

Payments registered on an invoice or expense (sink)

Calls `GET /v3/payments/{sink_id}`.

### payments register

`jortt payments register`

Register a Payment

Calls `POST /v3/payments/register` (makes a plan).

- `--sink-id <value>` Resource identifier (UUID) of the entity to be paid (required)
- `--amount <json>` amount (required)
- `--book-date <value>` Date the payment is booked on.
- `--ledger-account-id <value>` Identifier (UUID) of the ledger account the payment is made from, as returned under GET /v3/ledger_…
- `--source-id <value>` Resource identifier (UUID) of the entity which is used as payment source
- `--description <value>` Description of the payment

Body fields:

```
sink_id* (string)  Resource identifier (UUID) of the entity to be paid
amount* (object)
  amount* (string)
  currency* (string)  [EUR]
book_date (string)  Date the payment is booked on.
ledger_account_id (string)  Identifier (UUID) of the ledger account the payment is made from, as returned under GET /…
source_id (string)  Resource identifier (UUID) of the entity which is used as payment source
description (string)  Description of the payment
```

### payments deregister

`jortt payments deregister`

Deregister a Payment

Calls `POST /v3/payments/deregister` (makes a plan).

- `--sink-id <value>` Resource identifier (UUID) of the entity the payment was registered on (required)
- `--booking-id <value>` Booking identifier (UUID) of the payment to deregister (required)

Body fields:

```
sink_id* (string)  Resource identifier (UUID) of the entity the payment was registered on
booking_id* (string)  Booking identifier (UUID) of the payment to deregister
```

## receipts

Receipts in the inbox

### receipts list

`jortt receipts list`

List Receipts

Calls `GET /v3/receipts`.

- `--scope <in_inbox|all>` Which receipts to list.
- `--page <number>` Page to fetch (100 per page)
- `--all` Fetch every page (stops at --limit)

### receipts show

`jortt receipts show <receipt-id>`

Get Receipt by ID

Calls `GET /v3/receipts/id/{id}`.

### receipts download

`jortt receipts download <receipt-id>`

Get the download link (add --out file to save it)

Calls `GET /v3/receipts/id/{id}/download`.

- `--out <file>` Save the file behind the download link here

## api

`jortt api <method> <path>`

Call any Jortt endpoint directly (escape hatch for anything without a friendly command)

- `-q, --query <key=value>` Query parameter (repeatable)
- `--all` For list endpoints: fetch every page
- `--out <file>` For download endpoints: save the file behind the link

## endpoints

`jortt endpoints [words...]`

List or search every Jortt API endpoint (from the bundled docs catalog)

- `--group <name>` Only this docs group, e.g. Invoices

## describe

`jortt describe <endpoint>`

Show an endpoint's parameters and body fields

