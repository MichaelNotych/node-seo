const fs = require("fs");
const { shuffleArray } = require("./helpers");
const { connectToBrowser, newPage, doSearch, getSearchItems } = require("./services/puppeteer");
const { getProfiles, startProfile } = require("./services/undetectable");

async function processTasksFile(path) {
	const taskTxt = fs.readFileSync(path, "utf-8");
	const tasks = taskTxt.split('\n');
	const groups = {};

	// формируем по каждой группе объект вида
	// { requestsLimit: number, tasks: [{ url: string, request: string, additionalRequest: string }] }
	for (let i = 0; i < tasks.length; i++) {
		const [group, requestsLimit, url, request, additionalRequest] = tasks[i].split(';');

		if (!groups[group]) {
			groups[group] = {
				requestsLimit,
				requestsSent: 0,
				tasks: [],
			}
		}
		groups[group].tasks.push({ url, request, additionalRequest });
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
			const { url, request, additionalRequest } = group.tasks[i];
			console.log(`processing task: ${url}, request: ${request}, additionalRequest: ${additionalRequest}`);
			await processTask(url, request, additionalRequest);
		}
	}
}

/**
 * Обработка задачи
 * @param {string} url - адрес страницы
 * @param {string} request - строка поиска
 * @param {string} additionalRequest - дополнительный поисковый запрос
 * @returns {Promise<void>}
 */
async function processTask(url, request, additionalRequest) {
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
	// переходим в поисковик
	const page = await newPage(browser, "https://mail.ru/");
	// делаем поиск по первичному запросу
	let resultFrame = await doSearch(request, page, true);
	// если фрейма нет, то выходим из цикла
	if (!resultFrame) {
		console.log('Iframe not found or not accessible.');
		await browser.close();
		return;
	}

	// в фрейме запускаем js код
	// который проходится по каждому поисковому элементу
	// и собирает данные: заголовок, описание, ссылка
	let resultItems = await getSearchItems(resultFrame);

	// проходимся по всем результатам и ищем нужную ссылку
	let itemToSearchIndex = null;
	let itemToSearch = resultItems.find((item, index) => {
		if (item.url.includes(url)) {
			itemToSearchIndex = index;
		}
		return item.url.includes(url);
	});

	// если нет нужной ссылки, то делаем 
	// догугливание в поиске
	if (!itemToSearch) {
		console.log('apply additional request')
		resultFrame = await doSearch(`${request} ${additionalRequest}`, page);
		resultItems = await getSearchItems(resultFrame);

		itemToSearch = resultItems.find((item, index) => {
			if (item.url.includes(url)) {
				itemToSearchIndex = index;
			}
			return item.url.includes(url);
		});
	}

	console.log(`target item (index in result: ${itemToSearchIndex}):`, itemToSearch);

	//console.log('other results', resultItems);

	await browser.close();
}

module.exports = {
	processTasksFile,
};