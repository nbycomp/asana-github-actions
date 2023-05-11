const action = require("./action");
const core = require("@actions/core");
const github = require("@actions/github");

describe("asana github actions", () => {
  let inputs = {};
  let defaultBody;
  let mergeBody;
  let client;
  let task;

  const asanaPAT = process.env["ASANA_PAT"];
  if (!asanaPAT) {
    throw new Error("need ASANA_PAT in the test env");
  }
  const projectId = process.env["ASANA_PROJECT_ID"];
  if (!projectId) {
    throw new Error("need ASANA_PROJECT_ID in the test env");
  }

  const commentId = Date.now().toString();

  beforeAll(async () => {
    // Mock getInput
    jest.spyOn(core, "getInput").mockImplementation((name, options) => {
      if (inputs[name] === undefined && options && options.required) {
        throw new Error(name + " was not expected to be empty");
      }
      return inputs[name];
    });

    // Mock error/warning/info/debug
    jest.spyOn(core, "error").mockImplementation(jest.fn());
    jest.spyOn(core, "warning").mockImplementation(jest.fn());
    jest.spyOn(core, "info").mockImplementation(jest.fn());
    jest.spyOn(core, "debug").mockImplementation(jest.fn());

    github.context.ref = "refs/heads/some-ref";
    github.context.sha = "1234567890123456789012345678901234567890";

    process.env["GITHUB_REPOSITORY"] = "a-cool-owner/a-cool-repo";

    client = await action.buildClient(asanaPAT);
    if (client === null) {
      throw new Error("client authorization failed");
    }

    task = await client.tasks.create({
      name: "my fantastic task",
      notes: "generated automatically by the test suite",
      projects: [projectId],
    });

    defaultBody = `Implement https://app.asana.com/0/${projectId}/${task.gid} in record time`;
    mergeBody = `<!--Paste a link to the Asana ticket-->
<!--Cross the checkbox to indicate that you want to close the Asana Task when the PR is merged-->
**Asana Task:**
https://app.asana.com/0/${projectId}/${task.gid}

- [x] close on merge
`;
  });

  afterAll(async () => {
    await client.tasks.delete(task.gid);
  });

  beforeEach(() => {
    // Reset inputs
    inputs = {};
    github.context.payload = {};
  });

  test("asserting a links presence", async () => {
    inputs = {
      "asana-pat": asanaPAT,
      action: "assert-link",
      "link-required": "true",
      "github-token": "fake",
      "trigger-phrase": "Implement",
    };
    github.context.payload = {
      pull_request: {
        body: defaultBody,
        head: {
          sha: "1234567890123456789012345678901234567890",
        },
      },
    };

    const mockCreateStatus = jest.fn();
    github.GitHub = jest.fn().mockImplementation(() => {
      return {
        repos: {
          createStatus: mockCreateStatus,
        },
      };
    });

    await action.action();

    expect(mockCreateStatus).toHaveBeenCalledWith({
      owner: "a-cool-owner",
      repo: "a-cool-repo",
      context: "asana-link-presence",
      state: "success",
      description: "asana link not found",
      sha: "1234567890123456789012345678901234567890",
    });
  });

  test("creating a comment", async () => {
    inputs = {
      "asana-pat": asanaPAT,
      action: "add-comment",
      "comment-id": commentId,
      text: "rad stuff",
      "is-pinned": "true",
      "trigger-phrase": "Implement",
    };
    // Mock github context
    github.context.payload = {
      pull_request: {
        body: defaultBody,
      },
    };

    await expect(action.action()).resolves.toHaveLength(1);

    // rerunning with the same comment-Id should not create a new comment
    await expect(action.action()).resolves.toHaveLength(0);
  });

  test("removing a comment", async () => {
    inputs = {
      "asana-pat": asanaPAT,
      action: "remove-comment",
      // note: relies on the task being created in `creating a comment` test
      "comment-id": commentId,
      "trigger-phrase": "Implement",
    };
    github.context.payload = {
      pull_request: {
        body: defaultBody,
      },
    };

    await expect(action.action()).resolves.toHaveLength(1);
  });

  test("moving sections", async () => {
    inputs = {
      "asana-pat": asanaPAT,
      action: "move-section",
      targets: '[{"project": "Asana bot test environment", "section": "Done"}]',
      "trigger-phrase": "Implement",
    };
    github.context.payload = {
      pull_request: {
        body: defaultBody,
      },
    };

    await expect(action.action()).resolves.toHaveLength(1);

    inputs = {
      "asana-pat": asanaPAT,
      action: "move-section",
      targets: '[{"project": "Asana bot test environment", "section": "New"}]',
      "trigger-phrase": "Implement",
    };

    await expect(action.action()).resolves.toHaveLength(1);
  });

  test("completing task", async () => {
    inputs = {
      "asana-pat": asanaPAT,
      action: "complete-task",
      "is-complete": "true",
      "trigger-phrase": "\\*\\*Asana Task:\\*\\*",
    };
    github.context.payload = {
      pull_request: {
        body: mergeBody,
      },
    };

    await expect(action.action()).resolves.toHaveLength(1);
    const actualTask = await client.tasks.findById(task.gid);
    expect(actualTask.completed).toBe(true);
  });
  test("updating Github PR field content of a task", async () => {
    inputs = {
      "asana-pat": asanaPAT,
      action: "update-custom-field",
      "field-name": "Github PR",
      "trigger-phrase": "Implement",
      content: "https://this-is-a-pr-link.com/",
    };
    github.context.payload = {
      pull_request: {
        body: defaultBody,
      },
    };

    await expect(action.action()).resolves.toHaveLength(1);
    const actualTask = await client.tasks.findById(task.gid);
    expect(actualTask.custom_fields).toContainEqual(
      expect.objectContaining({
        name: "Github PR",
        display_value: "https://this-is-a-pr-link.com/",
      })
    );
  });
  test("updating Task Progress field of a task", async () => {
    inputs = {
      "asana-pat": asanaPAT,
      action: "change-task-progress",
      "trigger-phrase": "\\*\\*Asana Task:\\*\\*",
      state: "Waiting",
    };
    github.context.payload = {
      pull_request: {
        body: mergeBody,
      },
    };

    await expect(action.action()).resolves.toHaveLength(1);
    const actualTask = await client.tasks.findById(task.gid);
    expect(actualTask.custom_fields).toContainEqual(
      expect.objectContaining({
        name: "Task Progress",
        display_value: "Waiting",
      })
    );
  });
});
