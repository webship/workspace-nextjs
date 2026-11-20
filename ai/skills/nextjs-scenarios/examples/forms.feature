Feature: The invoices form
  The form's action runs on the server: its errors come back next to each field and for the whole
  form, and an invoice created is listed without a full page reload. What a scenario creates, it deletes.

  Scenario: The errors of the server are shown next to each field and for the whole form
    Given I am a logged in user with the "editor" user
    And I am on "/dashboard/invoices/create"
    When I send the form with "Create Invoice"
    Then the field "Choose customer" should show the error "Please select a customer."
    And the field "Choose an amount" should show the error "Please enter an amount greater than $0."
    And the field "Set the invoice status" should show the error "Please select an invoice status."
    And the form should show the message "Missing Fields. Failed to Create Invoice."
    And the form should have been sent without a full page reload

  Scenario: An invoice is created, listed and deleted
    Given I am a logged in user with the "administrator" user
    And I am on "/dashboard/invoices/create"
    When I select "Oak Example" from "Choose customer"
    And I fill in "Choose an amount" with "58.31"
    And I choose the radio button "Paid"
    And I send the form with "Create Invoice"
    Then the path should be "/dashboard/invoices"
    And I should see "$58.31"
    When I send the form with "Delete" in the "$58.31" row
    Then I should not see "$58.31"
