/**
 * Хелпер для задержки
 * @param {number} ms 
 * @returns Promise
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Перемешивает элементы внутри массива
 * @param {Array} arr - массив для рандомизации
 * @returns 
 */
function shuffleArray(arr) {
	let currentIndex = arr.length;

	while (currentIndex != 0) {
		// выбираем случайных индекс
		let randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;

		// менем случайно выбранный элемент с текущшим
		[arr[currentIndex], arr[randomIndex]] = [arr[randomIndex], arr[currentIndex]];
	}

	return arr;
}

module.exports = {
	sleep,
	shuffleArray,
};