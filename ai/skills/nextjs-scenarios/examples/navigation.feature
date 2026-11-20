Feature: Moving around the dashboard
  The links of the side navigation open their pages in the same document, the router says each new
  page to a screen reader, and the pages behind the links are fetched ahead of a click.

  Scenario: The side navigation opens each page without a full page reload
    Given I am a logged in user with the "administrator" user
    And I am on "/dashboard"
    When I click the link "Invoices" without a full page reload
    Then the path should be "/dashboard/invoices"
    And the route announcer should announce "Invoices"
    When I click the link "Customers" without a full page reload
    Then the route announcer should announce "Customers"
    And I should see "Ivy Example"

  Scenario: Back and forward keep the page the browser has
    Given I am a logged in user with the "editor" user
    And I am on "/dashboard/invoices"
    When I click the link "Customers" without a full page reload
    And I go back without a full page reload
    Then the path should be "/dashboard/invoices"
    When I go forward without a full page reload
    Then the path should be "/dashboard/customers"

  Scenario: The pages of the side navigation are fetched ahead of a click
    Given I am a logged in user with the "administrator" user
    When I go to "/dashboard"
    Then the page "/dashboard/invoices" should be prefetched
    And the page "/dashboard/customers" should be prefetched
