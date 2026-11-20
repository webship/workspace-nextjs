Feature: The app answers and its accounts work
  As the owner of the app
  I want the login form, each default account and the production build to work
  So that a build that came out broken is caught before anything else is tested

  # Placed by the workspace's testing setup as a starting point: it is yours to change.
  # The accounts are the default ones (cmd-tools-nextjs-cli.sh --add-users); a scenario logs in by a
  # handle of the users registry in cucumber.js, so no password is written here.

  @critical
  Scenario: A visitor who asks for the dashboard is sent to the login form
    Given I am an anonymous user
    When I go to "/dashboard"
    Then I should see the login form
    And the login form should send me back to "/dashboard"
    And I should not be logged in

  @critical
  Scenario Outline: The <account> account logs in
    Given I am a logged in user with the "<account>" user
    Then I should be logged in as "<account>"

    Examples:
      | account       |
      | administrator |
      | editor        |

  Scenario: The dashboard opens its pages in the same document, as a production build
    Given I am a logged in user with the "administrator" user
    When I click the link "Invoices" without a full page reload
    Then the route announcer should announce "Invoices"
    And the site should be served as a production build
    And there should be no hydration errors

  Scenario: Logging out ends the session
    Given I am a logged in user with the "editor" user
    When I log out
    Then I should not be logged in
