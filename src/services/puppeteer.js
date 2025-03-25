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

async function checkCaptcha(page) {
	const captchaForm = await page.$('form[action^="/checkcaptcha"]');
	console.log("captchaForm", captchaForm);

	return false;
}

/**
 * Произведение поиска
 * @param {string} request - строка запроса
 * @param {puppeteer.Page} page - объект страницы
 * @returns
 */
async function doSearch(request, page) {
	console.log(`do search - ${request}`);

	// находим фрейм с поисковым полем
	const searchFrameContent = await getYandexFrameContent(page);

	const input = await searchFrameContent.$(".mini-suggest__input");
	await input.type(request, { delay: 100 });

	// ждем 2 секунды
	await sleep(2000);

	// сабмитим форму нажимая Enter на клавиатуре
	await page.keyboard.press("Enter");

	// находим список результатов
	await searchFrameContent.waitForSelector("#search-result");
	await sleep(2000);

	// возвращаем фрейм с результатом поиска
	return searchFrameContent;
}

/**
 * Получение списка результатов поиска
 * @param {puppeteer.Frame} resultFrame - фрейм с результатом поиска
 * @param {string} url - адрес страницы
 * @returns {Promise<{item: {title: string, text: string, url: string}, index: number}>} - список результатов
 */
async function getSearchItems(resultFrame, url) {
	const results = await resultFrame.evaluate(() => {
		const items = document.querySelectorAll("#search-result .serp-item");

		return Array.from(items).map((element) => {
			const title = element.querySelector(".organic__title");
			const text = element.querySelector(".organic__text");
			return {
				title: title ? title.textContent : "undefined",
				text: text ? text.textContent : "undefined",
				url: element
					.querySelector("a")
					.getAttribute("href")
					.toLowerCase(),
			};
		});
	});

	if (!Array.isArray(results))
		return {
			item: null,
			index: null,
		};

	// проходимся по всем результатам и ищем нужную ссылку
	let itemToSearchIndex = null;
	let itemToSearch = results.find((item, index) => {
		if (item.url.includes(url)) {
			itemToSearchIndex = index;
		}
		return item.url.includes(url);
	});

	return {
		item: itemToSearch,
		index: itemToSearchIndex,
	};
}

/**
 * Обновление региона в поиске
 * @param {puppeteer.Page} page - объект страницы
 * @param {string} lr - номер региона
 * @returns
 */
async function updateRegion(page, lr) {
	const searchFrameContent = await getYandexFrameContent(page);

	await searchFrameContent.$eval(
		'[name="lr"]',
		(input, lr) => (input.value = lr),
		lr
	);
}

/**
 * Хелпер для получения поискового фрейма яндекса
 * @param {puppeteer.Page} page - объект страницы
 * @returns
 */
async function getYandexFrameContent(page) {
	await page.waitForSelector("iframe.yandex-frame");
	const searchFrame = await page.$("iframe.yandex-frame");
	const searchFrameContent = await searchFrame.contentFrame();
	return searchFrameContent;
}

/**
 * Посещение сайта из поисковой выдачи
 * @param {puppeteer.Page} page - объект страницы
 * @param {string} url - адрес страницы
 * @returns
 */
async function visitWebsite(page, url, browser) {
	const searchFrameContent = await getYandexFrameContent(page);
	console.log("try to click url", 'a[href="' + url + '"]');

	const searchItem = await searchFrameContent.$('a[href*="' + url + '"]');

	// Check if searchItem exists
	if (!searchItem) {
		console.log("Search item not found!");
		return;
	}

	console.log("Search item found, preparing to click");

	const newPagePromise = new Promise((resolve) =>
		browser.once("targetcreated", (target) => resolve(target.page()))
	);

	searchItem.click();

	const newPage = await newPagePromise;

	await newPage.bringToFront();
	await newPage.waitForSelector("body", { timeout: 5000 });
	console.log("Navigated to:", await newPage.url());

	await simulateRandomMobileScrolling(newPage);
}

/**
 * Simulates realistic mobile scrolling with completely randomized behavior
 * @param {Page} page - Puppeteer page object
 */
async function simulateRandomMobileScrolling(page) {
	console.log("Starting random mobile scrolling simulation");

	try {
		// получаем параметры страницы
		const dimensions = await page.evaluate(() => {
			return {
				pageHeight: document.body.scrollHeight,
				viewportHeight: window.innerHeight,
				pageWidth: document.body.scrollWidth,
				viewportWidth: window.innerWidth,
			};
		});

		console.log("Page dimensions:", dimensions);

		// генерируем рандомные параметры
		const scrollSteps = Math.floor(Math.random() * 15) + 8; // 8-23 steps
		const totalDuration = Math.floor(Math.random() * 20000) + 10000; // 10-30 seconds
		const initialDelay = Math.floor(Math.random() * 2000) + 500; // 500-2500ms wait before scrolling

		console.log(
			`Random scrolling: ${scrollSteps} steps over ${
				totalDuration / 1000
			}s`
		);

		// первичная задержка
		await new Promise((resolve) => setTimeout(resolve, initialDelay));

		// расчитываем среднее врем на 1 шаг
		const avgTimePerStep = totalDuration / scrollSteps;

		for (let i = 0; i < scrollSteps; i++) {
			// определяем дистанцию скрола
			const swipeDistance = Math.floor(Math.random() * 400) + 150; // 150-550px

			// рандомно расчитываем координаты скрола
			const viewportMiddleX = dimensions.viewportWidth / 2;
			const swipeStartY =
				dimensions.viewportHeight * (0.6 + Math.random() * 0.3); // Bottom 60-90% of screen
			const swipeEndY = swipeStartY - swipeDistance;

			// добавляем рандом на оси Х
			const startX = viewportMiddleX + (Math.random() * 60 - 30); // ±30px from center
			const endX = viewportMiddleX + (Math.random() * 60 - 30); // ±30px from center

			try {
				// тапаем экран
				await page.touchscreen.touchStart(startX, swipeStartY);
				// мини задержка
				await new Promise((resolve) =>
					setTimeout(resolve, 50 + Math.random() * 70)
				);

				// двигаем палец маленькими шагами
				const moveSteps = 3 + Math.floor(Math.random() * 7); // 3-10 small moves
				const xStep = (endX - startX) / moveSteps;
				const yStep = (swipeEndY - swipeStartY) / moveSteps;

				for (let step = 1; step <= moveSteps; step++) {
					const currentX = startX + xStep * step;
					const currentY = swipeStartY + yStep * step;
					await page.touchscreen.touchMove(currentX, currentY);
					await new Promise((resolve) =>
						setTimeout(resolve, 10 + Math.random() * 20)
					);
				}

				await page.touchscreen.touchEnd();
				console.log(
					`Swiped from (${startX.toFixed(
						0
					)}, ${swipeStartY.toFixed(0)}) to (${endX.toFixed(
						0
					)}, ${swipeEndY.toFixed(0)})`
				);
			} catch (e) {
				console.log(`Touch gesture failed: ${e.message}`);
				// Fall back to JS scrolling if touch fails
				await page.evaluate(
					(distance) => window.scrollBy(0, distance),
					swipeDistance
				);
				console.log(
					`Used JS scrolling as fallback: ${swipeDistance}px`
				);
			}

			// рандомно ждем между скролами
			const scrollTime = Math.floor(
				avgTimePerStep * (1 + Math.random() * 0.8)
			);
			console.log('scrollTime', scrollTime);
			await new Promise((resolve) => setTimeout(resolve, scrollTime));

			// Random chance to pause (simulating reading content)
			if (Math.random() < 0.25) {
				// 25% chance to pause
				const pauseDuration = Math.floor(Math.random() * 3000) + 500; // 500-3500ms pause
				console.log(`Pausing for ${pauseDuration}ms to "read" content`);
				await new Promise((resolve) =>
					setTimeout(resolve, pauseDuration)
				);
			}

			// Check if we've reached the bottom of the page
            const reachedBottom = await page.evaluate(() => {
                const scrollPosition = window.scrollY + window.innerHeight;
                const documentHeight = document.body.scrollHeight;
                // Allow a small margin of error (20px)
                return scrollPosition >= documentHeight - 20;
            });
            
            if (reachedBottom) {
                console.log("Reached the bottom of the page, stopping scrolling");
                // Small pause at the bottom
                await new Promise((resolve) =>
                    setTimeout(resolve, 1000 + Math.random() * 2000)
                );
                break; // Exit the for loop
            }
		}

		console.log("Random mobile scrolling simulation completed");
	} catch (error) {
		console.log(`Error during scrolling: ${error.message}`);
	}
}

module.exports = {
	connectToBrowser,
	newPage,
	checkCaptcha,
	doSearch,
	getSearchItems,
	updateRegion,
	visitWebsite,
};
