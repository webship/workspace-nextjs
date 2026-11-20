Feature: The app answers as a production build
  As the owner of the app
  I want its first page served as a hydrated production build, and an unknown address answered by a 404
  So that a build that came out broken is caught before anything else is tested

  # Placed by the workspace's testing setup as a starting point: it is yours to change.

  @critical
  Scenario: The first page is a hydrated production build
    Given I am on "/"
    Then the site should be served as a production build
    And I should see a hydrated page
    And there should be no hydration errors
    And the page should have a route announcer

  @js-off
  Scenario: An address with no route answers with the not-found page
    When I go to "/no-such-page"
    Then I should be on a 404 page
