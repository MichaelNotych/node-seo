const axios = require("axios");
const API_URL = "http://127.0.0.1:25325";

/**
 * Проверка статуса undetectable
 */
async function getStatus() {
	try {
		const response = await axios.get(`${API_URL}/status`);
		return response.data.code === 0;
	} catch (error) {
		console.error("Error fetching status:", error.message);
		return false;
	}
}

/**
 * Запрос доступных профилей
 */
async function getProfiles() {
	try {
		const response = await axios.get(`${API_URL}/list`);
		return response.data.data;
	} catch (error) {
		console.error("Error fetching profiles:", error.message);
		return [];
	}
}

/**
 * Запуск профиля по айдишнику
 * @param {string} profileId - айди профиля
 */
async function startProfile(profileId) {
	try {
		console.log(`start profile: ${profileId}`);
		const response = await axios.get(`${API_URL}/profile/start/${profileId}`);
		return response.data.data;
	} catch (error) {
		console.error("Error starting profile:", error.message);
		return false;
	}
}

module.exports = {
	getStatus,
	getProfiles,
	startProfile,
};