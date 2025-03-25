const { shuffleArray } = require("./helpers");
const { connectToBrowser, newPage, doSearch, getSearchItems: getSearchItem, checkCaptcha, updateRegion, visitWebsite } = require("./services/puppeteer");
const { getProfiles, startProfile } = require("./services/undetectable");

const START_PAGE_URL = 'https://mail.ru/search?text&search_source=mailru_desktop_simple&msid=1&serp_path=%2Fsearch%2F&type=web';

async function parseTasksFile(taskTxt) {
	const tasks = taskTxt.split('\n');
	const groups = {};

	// формируем по каждой группе объект вида
	// { requestsLimit: number, tasks: [{ url: string, request: string, additionalRequest: string }] }
	for (let i = 0; i < tasks.length; i++) {
		const [group, requestsLimit, url, request, additionalRequest, lr] = tasks[i].split(';');

		if (!groups[group]) {
			groups[group] = {
				requestsLimit,
				requestsSent: 0,
				tasks: [],
			}
		}
		groups[group].tasks.push({ url, request, additionalRequest, lr });
	}

	// перемешиваем массивы задач
	for (let groupName in groups) {
		groups[groupName].tasks = shuffleArray(groups[groupName].tasks);
	}

	// проходимся по каждой группе
	// и запускаем задачи
	for (let groupName in groups) {
		const group = groups[groupName];
		console.log(`start processing group: ${groupName}`);
		const allGroupTasks = [];
		
		for (let i = 0; i < Math.floor(group.requestsLimit / group.tasks.length); i++) {
			allGroupTasks.push(...group.tasks);
		}

		for (let i = 0; i < group.requestsLimit % group.tasks.length; i++) {
			allGroupTasks.push(group.tasks[i]);
		}

		console.log(allGroupTasks);

		for (let i = 0; i < group.tasks.length; i++) {
			console.log('process task:');
			console.log(group.tasks[i]);
			await processTask(group.tasks[i]);
		}
	}
}

/**
 * Обработка задачи
 * @param {Object} task
 * @returns {Promise<void>}
 */
async function processTask(task) {
	const { url, request, additionalRequest, lr } = task;
	// получаем список профилей
	const profiles = await getProfiles();

	// перемешиваем профили и выбираем первый айдишник
	// с ним выполняем задачу
	const shuffledProfilesId = shuffleArray(Object.keys(profiles));
	const currentProfileId = shuffledProfilesId[0];

	// стартуем профиль
	const profile = await startProfile(currentProfileId);
	// подключаемся к хрому
	const browser = await connectToBrowser(profile.websocket_link);

	try {
		// переходим в поисковик
		const page = await newPage(browser, START_PAGE_URL);
		// обновляем регион
		console.log('set region')
		await updateRegion(page, lr);

		const pageHasCaptcha = await checkCaptcha(page);
		if (pageHasCaptcha) return console.log('pageHasCaptcha', pageHasCaptcha)
		// делаем поиск по первичному запросу
		let resultFrame = await doSearch(request, page);
		// если фрейма нет, то выходим из цикла
		if (!resultFrame) {
			throw new Error('Iframe not found or not accessible.');
		}

		// в фрейме запускаем js код
		// который проходится по каждому поисковому элементу
		// и собирает данные: заголовок, описание, ссылка
		let searchItem = await getSearchItem(resultFrame, url);

		// если нет нужной ссылки, то делаем 
		// догугливание в поиске
		if (!searchItem.item) {
			console.log('apply additional request')
			resultFrame = await doSearch(` ${additionalRequest}`, page);
			searchItem = await getSearchItem(resultFrame, url);
		}

		if (!searchItem.item) {
			throw new Error('Target item not found.');
		}

		console.log(`target item (index in result: ${searchItem.index}):`, searchItem.item);	

		await visitWebsite(page, url, browser);

	} catch (error) {
		console.log('## ERROR', error.message);
	} finally {
		await sleep(2000);
		await browser.close();
	}
}

module.exports = {
	parseTasksFile,
};