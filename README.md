# Github-Asana action

This action integrates asana with github.

### Prerequisites

- Asana account with the permission on the particular project you want to integrate with.
- Must provide the task url in the PR description.

## Inputs

### `asana-pat`

**Required** - Your public access token for asana, you can generate one [here](https://app.asana.com/0/developer-console).

### `action`

**Required** - The action to be performed assert-link|add-comment|remove-comment|move-section|complete-task|update-custom-field|change-task-progress

### `github-token`

**Required for `assert-link`** - A github auth token (used to set statuses)

### `trigger-phrase`

**Optional** - Prefix before the task i.e ASANA TASK: https://app.asana.com/1/2/3/.

### `text`

**Required for `add-comment`** - If any comment is provided, the action will add a comment to the specified asana task with the text.

### `comment-id`

**Required for `remove-comment`, Optional for `add-comment`** - When provided in add-comment, gives a unique identifier that can later be used to delete the comment

### `is-pinned`

**Optional for `add-comment`** - Mark a comment as pinned in asana

### `targets`

**Required for `move-section`** - JSON array of objects having project and section where to move current task. Move task only if it exists in target project. e.g

```yaml
targets: '[{"project": "Backlog", "section": "Development Done"}, {"project": "Current Sprint", "section": "In Review"}]'
```

if you don't want to move task omit `targets`.

### `link-required`

**Required for `assert-link`** - When set to true will fail pull requests without an asana link

### `is-complete`

**Required for `complete-task`** - If the task is complete or not

### `content`

**Required for `update-custom-field`** - String content to set in the task custom field.

### `field-name`

**Required for `update-custom-field`** - Name of the custom field to update.

### `state`

**Required for `change-task-progress`** - Name of the enum option that we want to set in Task Progress field of the task.

## Example usage

```yaml
name: Move a task to a different section

on:
  pull_request:
    types: [closed]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: nbycomp/asana-github-actions@master
        if: github.event.pull_request.merged
        with:
          asana-pat: ${{ secrets.ASANA_PAT }}
          action: "move-section"
          targets: '[{"project": "Engineering scrum", "section": "Done"}]'
```

```yaml
name: Add a comment

on:
  pull_request:
    types: [opened, edited, labeled, unlabeled]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: set pr number
        run: echo "::set-env name=PR_NUMBER::$(echo -n "${GITHUB_REF}" | awk 'BEGIN { FS = "/" } ; { print $3 }')"
      - uses: nbycomp/asana-github-actions@master
        with:
          asana-pat: ${{ secrets.ASANA_PAT }}
          action: "add-comment"
          comment-id: "#pr:${{env.PR_NUMBER}}"
          text: "View Pull Request: https://github.com/everphone-gmbh/frontend-symfony/pull/${{env.PR_NUMBER}}"
          is-pinned: true
```

```yaml
name: Remove a comment

on:
  pull_request:
    types: [closed]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: set pr number
        run: echo "::set-env name=PR_NUMBER::$(echo -n "${GITHUB_REF}" | awk 'BEGIN { FS = "/" } ; { print $3 }')"
      - uses: nbycomp/asana-github-actions@master
        if: github.event.pull_request.merged
        with:
          asana-pat: ${{ secrets.ASANA_PAT }}
          action: "remove-comment"
          comment-id: "#pr:${{env.PR_NUMBER}}"
```

```yaml
name: Validate asana link presence

on:
  pull_request:
    # revalidate on label changes
    types: [opened, edited, labeled, unlabeled]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: nbycomp/asana-github-actions@master
        with:
          asana-pat: ${{ secrets.ASANA_PAT }}
          action: assert-link
          # if the branch is labeled a hotfix, skip this check
          link-required: ${{ !contains(github.event.pull_request.labels.*.name, 'hotfix') }}
          github-token: ${{ github.token }}
```

```yaml
name: Mark a task complete

on:
  pull_request:
    types: [closed]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: nbycomp/asana-github-actions@master
        if: github.event.pull_request.merged
        with:
          asana-pat: ${{ secrets.ASANA_PAT }}
          action: "complete-task"
          is-complete: true
```

```yaml
name: Set github PR link in asana task

on:
  pull_request:
    types: ["opened", "edited", "reopened", "synchronize"]

jobs:
  asana-link:
    runs-on: ubuntu-latest
    steps:
      - uses: nbycomp/asana-github-actions@master
        with:
          asana-pat: ${{ secrets.ASANA_TOKEN }}
          action: "update-custom-field"
          field-name: "Github PR"
          trigger-phrase: "\\*\\*Asana Task:\\*\\*"
          content: "https://github.com/${{github.repository}}/pull/${{github.event.pull_request.number}}"
```

```yaml
name: Update task status to waiting

on:
  pull_request:
    types: ["opened", "edited", "reopened", "synchronize"]

jobs:
  update-task-progress:
    if: ${{ !github.event.pull_request.draft }}
    runs-on: ubuntu-latest
    steps:
      - uses: nbycomp/asana-github-actions@master
        with:
          asana-pat: ${{ secrets.ASANA_TOKEN }}
          action: "change-task-progress"
          trigger-phrase: "\\*\\*Asana Task:\\*\\*"
          state: "Waiting"
```

## Testing

Tests can be run using `npm test`.

The tests connect to a running instance of Asana, and create/modify tasks inside a project
called "Asana bot test environment". This project must be created in advance,
with three sections: "Todo", "Waiting" and "Done".

The following environment variables must be set:

ASANA_PAT: your Personal Access Token
ASANA_PROJECT_ID: The ID of the project "Asana bot test environment"
