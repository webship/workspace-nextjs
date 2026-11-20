Feature: The Next.js plugin on the dashboard
  Once the plugin is activated and installed, the sites folders offer the Next.js builder, each
  AI folder lists the items of its kind the plugin ships, and Settings lists the plugin with
  what it ships.

  # Settings lists every plugin that was added; the package and what the plugin ships are on its own page.
  Scenario: Settings lists the plugin, and its own page names its package and what it ships
    Given I am on "/settings"
     Then I should see "Next.js"
     When I go to "/settings/plugin/nextjs"
     Then I should see "@webship.co/workspace-nextjs"
      And I should see "cmd-nextjs-project.sh"
      And I should see "nextjs-site-builder"

  Scenario: A sites folder offers the Next.js builder
    Given I am on "/dev"
     Then "option[value='cmd-nextjs-project.sh']" should be attached

  # The AI folders are searched by name: with every plugin on, a folder lists more than one page of items.
  Scenario: The AI Agents folder lists the agents the plugin ships
    Given I am on "/ai-agents?q=nextjs-"
     Then I should see "nextjs-site-builder"
      And I should see "nextjs-tester"

  Scenario: The AI Skills folder lists the skill the plugin ships
    Given I am on "/ai-skills?q=nextjs-scenarios"
     Then I should see "nextjs-scenarios"

  Scenario: The AI Commands folder lists the command the plugin ships
    Given I am on "/ai-commands?q=nextjs-test"
     Then I should see "nextjs-test"

  Scenario: The AI Prompts folder lists the prompts the plugin ships
    Given I am on "/ai-prompts?q=nextjs-"
     Then I should see "nextjs-build-and-test"
      And I should see "nextjs-scenarios-for-a-page"
