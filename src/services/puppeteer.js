const puppeteer = require("puppeteer");
const { sleep } = require("../helpers");



/**
 * Подключение к браузеру через профиль
 * @param {string} websocketLink - адрес подключения
 */
async function connectToBrowser(websocketLink) {
	return await puppeteer.connect({
		browserWSEndpoint: websocketLink,
		defaultViewport: null,
	});
}

/**
 * Открытие новой вкладки
 * @param {puppeteer.Browser} browser - сущность браузера
 * @param {string} url - адрес вкладки
 * @returns {Promise<puppeteer.Page>} открытая страница
 */
async function newPage(browser, url) {
	const page = await browser.newPage();
	await sleep(1000);
	await page.goto(url);
	return page;
}

/**
 * Произведение поиска
 * @param {string} request - строка запроса
 * @param {puppeteer.Page} page - объект страницы 
 * @param {boolean} firstTry - флаг первой попытки поиска
 * @returns 
 */
async function doSearch(request, page, firstTry) {
	console.log(`do search - ${request} (${firstTry ? 'first try' : 'another try'})`);

	let searchFrame = null;
	let searchFrameContent = null;
	if (firstTry) {
		// находим фрейм с поисковым полем
		searchFrame = await page.waitForSelector("iframe.search-arrow__frame");
		searchFrameContent = await searchFrame.contentFrame();
		
		// заполняем поисковое поле
		await searchFrameContent.waitForSelector('.arrow__input');
		await searchFrameContent.type('.arrow__input', request, { delay: 100 });
		await searchFrameContent.focus('.arrow__input');
	} else {
		// ожидаем появления фрейма с предыдущими результатом
		// и строкой поиска
		await page.waitForSelector('iframe.yandex-frame');

		// находим фрейм с поисковым полем
		searchFrame = await page.$("iframe.yandex-frame");
		searchFrameContent = await searchFrame.contentFrame();

		// очищаем строку поиска
		const clearSearchButton = await searchFrameContent.$('.mini-suggest__input-clear');
		await clearSearchButton.click();
		await sleep(1000);
		
		// заполняем поисковое поле
		await searchFrameContent.waitForSelector('form.mini-suggest input');
		await searchFrameContent.type('form.mini-suggest input', request, { delay: 100 });
		await searchFrameContent.focus('form.mini-suggest input');
	}

	// ждем 2 секунды
	await sleep(2000);

	// сабмитим форму нажимая Enter на клавиатуре
	await page.keyboard.press('Enter');

	// ожидаем появления фрейма с результатами
	await page.waitForSelector('iframe.yandex-frame');
	const resultFrame = await page.$('iframe.yandex-frame');
	const resultFrameContent = await resultFrame.contentFrame();
	// если фрейма нет, выходим
	if (!resultFrameContent) return null;

	// находим список результатов
	await resultFrameContent.waitForSelector('#search-result');
	await sleep(2000);

	// возвращаем фрейм с результатом поиска
	return resultFrameContent;
}

/**
 * Получение списка результатов поиска
 * @param {puppeteer.Frame} resultFrame - фрейм с результатом поиска
 * @returns {Promise<Array<{title: string, text: string, url: string}>>} - список результатов
 */
async function getSearchItems(resultFrame) {
	return resultFrame.evaluate(() => {
		const items = document.querySelectorAll('#search-result .serp-item');

		return Array.from(items).map(element => {
			const title = element.querySelector('.organic__title');
			const text = element.querySelector('.organic__text');
			return {
				title: title ? title.textContent : 'undefined',
				text: text ? text.textContent : 'undefined',
				url: element.querySelector('a').getAttribute('href').toLowerCase().slice(0, 50),
			};
		});
	});
}

module.exports = {
	connectToBrowser,
	newPage,
	doSearch,
	getSearchItems,
};