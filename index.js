const { getStatus } = require("./src/services/undetectable");
const { processTasksFile } = require("./src/tasks");

const TASK_PATH = "./tasks/task.txt";

// Main function
async function main() {
	if (!(await getStatus())) {
		console.error("Profile manager is not available.");
		return;
	}

	processTasksFile(TASK_PATH);
}

main().catch(console.error);