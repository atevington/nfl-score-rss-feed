require("dotenv").config()

const request = require("request")
const RSS = require("rss")
const md5 = require("md5")
const moment = require("moment-timezone")
const express = require("express")
const app = express()
const port = process.env.PORT || 3000
const baseFeedUrl = process.env.BASE_FEED_URL || ""
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

const getFeedTitle = gamesData => (
	`NFL Live Score Updates ${gamesData.y}`
)

const getFeedDescription = gamesData => (
	`NFL Live Score Updates for the ${gamesData.y} Season`
)

const getFeedUrl = (baseFeedUrl, teams) => (
	`${baseFeedUrl}?teams=${encodeURIComponent(teams.join(","))}`
)

const getGameTitle = game => (
	`${game.vnn} @ ${game.hnn}`
)

const getGameDescription = game => (
	`${game.v}: ${game.vs}, ${game.h}: ${game.hs}`
)

const getGameUrl = (game, gamesData) => (
	`https://www.nfl.com/gamecenter/${game.eid}/${gamesData.y}/${gamesData.t}${gamesData.w}/` +
	`${game.vnn}@${game.hnn}?icampaign=scoreStrip-globalNav-${game.eid}`
)

const getGameHash = (game, gamesData, teams) => (
	md5(
		`${game.v}-${game.vs}-${game.h}-${game.hs}-${gamesData.w}-${gamesData.y}` +
		(teams.length > 0 ? `-${teams.join(",")}`: "")
	)
)

const getGameDate = game => (
	moment(new Date())
		.tz("America/New_York")
		.hour(parseInt(game.t.split(":")[0], 10) + 12)
		.minute(parseInt(game.t.split(":")[1], 10))
		.second(0)
		.millisecond(0)
)

const generateFeed = teams => new Promise((resolve, reject) => {
	makeGetRequest("https://www.nfl.com/liveupdate/scorestrip/ss.json")
		.then(gamesData => {
			const feed = new RSS({
				title: getFeedTitle(gamesData),
				description: getFeedDescription(gamesData),
				feed_url: getFeedUrl(baseFeedUrl, teams),
				site_url: siteUrl
			})
			
			gamesData.gms
				.filter(game => game.q !== "P")
				.filter(game => getGameDate(game).format("dddd").indexOf(game.d) === 0)
				.filter(game => teams.length === 0 || teams.indexOf(game.v) !== -1 || teams.indexOf(game.h) !== -1)
				.map(game => {
					feed.item({
						title: getGameTitle(game),
						description: getGameDescription(game),
						url: getGameUrl(game, gamesData),
						guid: getGameHash(game, gamesData, teams),
						date: getGameDate(game).toISOString()
					})
				})

			resolve(feed.xml({indent: true}))
		})
		.catch(reject)
})

app.get("/", (req, res) => {
	const teams = (req.query.teams || "").trim().length > 0 ?
		(req.query.teams || "").trim().split(",").map(team => team.trim().toUpperCase()).filter(team => team.length > 0) :
		[]

	generateFeed(teams).then(
		feed => res.header("Content-Type", "text/xml").send(feed),
		() => res.status(500).send({error: "An error occurred when generating the feed."})
	)
})

app.use("*", (req, res) => {
	res.status(404).send({error: "The requested resource was not found."})
})

app.listen(port, () => console.log(`Listening on port ${port}...`))
