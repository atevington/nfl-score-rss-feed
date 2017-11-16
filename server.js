require("dotenv").config()

const request = require("request")
const RSS = require("rss")
const md5 = require("md5")
const moment = require("moment-timezone")
const express = require("express")
const app = express()
const port = process.env.PORT || 3000
const basefeedUrl = process.env.BASE_FEED_URL || ""
const siteUrl = process.env.SITE_URL || ""

const makeGetRequest = url => new Promise((resolve, reject) => {
	request.get(url, (error, response, body) => {
		if (!error && response.statusCode === 200) {
			resolve(JSON.parse(body))
		} else {
			reject(error || response)
		}
	})
})

const generateFeed = (includeStartOfGame) => new Promise((resolve, reject) => {
	const scoreUrl = "https://www.nfl.com/liveupdate/scorestrip/ss.json"
	const now = new Date()
	const timeZone = "America/New_York"

	makeGetRequest(scoreUrl)
		.then(gameData => {
			const feed = new RSS({
				title: "NFL Live Score Updates",
				description: `NFL Live Score Updates for the ${gameData.y} Season`,
				feed_url: `${basefeedUrl}?includeStartOfGame=${includeStartOfGame ? "1" : "0"}`,
				site_url: siteUrl
			})
			
			gameData.gms
				.filter(game =>
					["P", "F", "FO"].indexOf(game.q) === -1 &&
					(includeStartOfGame || (game.vs !== 0 || game.hs !== 0))
				)
				.map(game => {
					const gameHour = parseInt(game.t.split(":")[0], 10) + 12, gameMinute = parseInt(game.t.split(":")[1], 10)
					
					feed.item({
						title: `${game.vnn} @ ${game.hnn}`,
						description: `${game.v}: ${game.vs}, ${game.h}: ${game.hs}`,
						url: `https://www.nfl.com/gamecenter/${game.eid}/${gameData.y}/${game.t}${gameData.w}/${game.vnn}@${game.hnn}?icampaign=scoreStrip-globalNav-${game.eid}`,
						guid: md5(`${game.v}-${game.vs}-${game.h}-${game.hs}-${gameData.w}-${gameData.y}`),
						date: moment(now)
							.tz(timeZone)
							.hour(gameHour)
							.minute(gameMinute)
							.second(0)
							.millisecond(0)
							.toISOString()
					})
				})

			const xml = feed.xml({indent: true});
			
			resolve(xml);
		})
		.catch(reject)
})

app.get("/", (req, res) => {
	const includeStartOfGame = req.query.includeStartOfGame === "1"
	
	generateFeed(includeStartOfGame).then(
		feed => res.header("Content-Type", "text/xml").send(feed),
		() => res.status(500).send({error: "An error occurred when generating the feed."})
	)
})

app.use("*", (req, res) => {
	res.status(404).send({error: "The requested resource was not found."})
})

app.listen(port, () => console.log(`Listening on port ${port}...`))