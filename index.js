const fs = require("fs");
const { getStatus } = require("./src/services/undetectable");
const { parseTasksFile } = require("./src/tasks");

const TASK_PATH = "tasks/task.txt";

// Main function
async function main() {
	if (!(await getStatus())) {
		console.error("Profile manager is not available.");
		return;
	}

	const taskTxt = fs.readFileSync(TASK_PATH, "utf-8");

	parseTasksFile(taskTxt);
}

main().catch(console.error);
