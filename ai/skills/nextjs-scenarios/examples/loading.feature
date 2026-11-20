Feature: Loading states
  On a slow network the parts of a page show their loading state, then their content; while the
  answer of a navigation is held back, the router keeps the page it shows. No step waits on a clock.

  Scenario: On a slow network the list shows its loading state, then its rows
    Given I am a logged in user with the "administrator" user
    And I am on "/dashboard/invoices"
    And the network is slow
    When I fill in "Search invoices..." with "Oak"
    Then a part of the page should show its loading state
    When I wait for the page to finish loading
    Then no part of the page should show its loading state
    And I should see "Oak Example"
    And the network is no longer slow

  Scenario: While the answer is on its way, the router keeps the page it shows
    Given I am a logged in user with the "editor" user
    And I am on "/dashboard/invoices"
    And the server's answers are held back
    When I click "Customers"
    Then the page should be waiting for the server
    And the path should be "/dashboard/invoices"
    When the server's answers come through
    Then the path should be "/dashboard/customers"
    And the page should not be waiting for the server
