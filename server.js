import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import fs from "fs";

const app = express();
const port = 3000;
let endpointUrl;
let token;
let slug;

app.set("view engine", "ejs");
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", (req, res) => {
	res.render("index.ejs", {
		title: "Main page",
	});
});

app.get("/settings", (req, res) => {
	const config = { title: "Settings" };
	if (endpointUrl) {
		config.status = "PRELOADED";
		config.url = new URL(`../${slug}`, endpointUrl).href;
	}
	console.log(config);
	res.render("settings.ejs", config);
});

app.post("/settings", async (req, res) => {
	try {
		const rawUrl = new URL(req.body.url);
		const rawEndpoint = rawUrl.origin + "/api";
		const rawSlugArray = rawUrl.pathname.split("/");
		if (rawSlugArray.length < 2 ? true : rawSlugArray[1] == "") {
			throw new Error("Missing slug name");
		}
		const rawToken = req.body.apiToken;
		const response = await axios.get(
			`${rawEndpoint}/v1/tournaments/${rawSlugArray[1]}`,
			{
				headers: { Authorization: `Token ${rawToken}` },
			}
		);
		if (response.status == 200) {
			endpointUrl = rawEndpoint;
			token = rawToken;
			slug = rawSlugArray[1];
			res.render("settings.ejs", {
				title: "Settings",
				status: "SUCCESS",
			});
		}
	} catch (error) {
		let errorMsg = "";
		if (error.response) {
			// Non-2xx
			if (error.response.status != 404) {
				errorMsg = `${error.response.status}: ${error.response.data.detail}`;
			} else {
				errorMsg = `${error.response.status}: Invalid URL`;
			}
		} else if (error.request) {
			// No response
			console.log(error.request);
			errorMsg = `Request failed: Could not find URL`;
		} else {
			// Other
			errorMsg = `Error: ${error.message}`;
		}

		res.render("settings.ejs", {
			title: "Settings",
			status: "ERROR",
			error: errorMsg,
		});
	}
});

//GET /teams
app.get("/teams", (req, res) => {
	res.render("upload_teams.ejs", {
		title: "Upload teams",
		canSubmit: Boolean(endpointUrl),
	});
});

//POST /teams
app.post("/teams", async (req, res) => {
	var logger = [];
	//Institution
	const institutionArray = [
		...new Set(
			req.body.teams.map((team) => {
				return team.institution;
			})
		),
	];
	// const returnedInstitution = await createInstitution(institutionArray, logger);
	//Team categories
	const teamCategoryArray = [
		...new Set(
			req.body.teams.reduce(
				(p, c) => p.concat(c.team_category ? c.team_category : []),
				[]
			)
		),
	];
	// const returnedTeamCategory = await createTeamCategory(
	// 	teamCategoryArray,
	// 	logger
	// );
	//Speaker categories
	const speakerCategoryArray = [
		...new Set(
			req.body.teams.reduce(
				(pTeam, cTeam) =>
					pTeam.concat(
						cTeam.speakers.reduce((pSpeaker, cSpeaker) => {
							return pSpeaker.concat(
								cSpeaker.category ? cSpeaker.category : []
							);
						}, [])
					),
				[]
			)
		),
	];
	// const returnedSpeakerCategory = await createSpeakerCategory(
	// 	speakerCategoryArray,
	// 	logger
	// );
	const [returnedInstitution, returnedTeamCategory, returnedSpeakerCategory] =
		await Promise.all([
			createInstitution(institutionArray, logger),
			createTeamCategory(teamCategoryArray, logger),
			createSpeakerCategory(speakerCategoryArray, logger),
		]);
	//Create teams
	await Promise.all(
		req.body.teams.map(async (team) => {
			const data = {
				reference: team.team_name,
				short_reference: team.team_reference,
				emoji: team.team_emoji ? team.team_emoji : null,
				institution: returnedInstitution.find((element) => {
					return element.name == team.institution;
				}).url,
				speakers: team.speakers.map((spk) => {
					return {
						name: spk.name,
						email: spk.email ? spk.email : null,
						categories: spk.category.map((c) => {
							return returnedSpeakerCategory.find((f) => {
								return c == f.name;
							}).url;
						}),
					};
				}),
				use_institution_prefix: req.body.autoPrefix,
				break_categories: team.team_category.map((e) => {
					return returnedTeamCategory.find((f) => {
						return e == f.name;
					}).url;
				}),
				institution_conflicts: [],
			};
			return await axios
				.post(`${endpointUrl}/v1/tournaments/${slug}/teams`, data, {
					headers: { Authorization: `Token ${token}` },
				})
				.then(() => {
					return `Team ${team.team_name} created successfully.`;
				})
				.catch((error) => {
					return `Team ${team.team_name} couldn't be created. (Error code: ${error.response.status})`;
				});
		})
	).then((responses) => {
		responses.forEach((response) => {
			logger.push(response);
			console.log(response);
		});
	});
	res.json(logger);
});

//GET /judges
app.get("/judges", (req, res) => {
	res.render("upload_judges.ejs", {
		title: "Upload judges",
		canSubmit: Boolean(endpointUrl),
	});
});

//POST /judges
app.post("/judges", async (req, res) => {
	var logger = [];
	//Institution
	const institutionArray = [
		...new Set(
			req.body.teams.map((team) => {
				return team.institution;
			})
		),
	];
	const returnedInstitution = await createInstitution(institutionArray, logger);

	//Create adjudicators
	await Promise.all(
		req.body.teams.map(async (adjudicator) => {
			const data = {
				name: adjudicator.name,
				email: adjudicator.email,
				institution: returnedInstitution.find((element) => {
					return element.name == adjudicator.institution;
				}).url,
				independent: adjudicator.independent,
				adj_core: adjudicator.adj_core,
				institution_conflicts: [],
				team_conflicts: [],
				adjudicator_conflicts: [],
			};
			return await axios
				.post(`${endpointUrl}/v1/tournaments/${slug}/adjudicators`, data, {
					headers: { Authorization: `Token ${token}` },
				})
				.then(() => {
					return `Judge ${adjudicator.name} created successfully.`;
				})
				.catch((error) => {
					return `Judge ${adjudicator.name} couldn't be created. (Error code: ${error.response.status})`;
				});
		})
	).then((responses) => {
		responses.forEach((response) => {
			logger.push(response);
			console.log(response);
		});
	});
	res.json(logger);
});

//LISTEN
app.listen(port, () => {
	console.log(`Server listening on port ${port}`);
});

async function createInstitution(institutions, logger) {
	//let responseReturn;
	const response = await axios.get(`${endpointUrl}/v1/institutions`, {
		headers: { Authorization: `Token ${token}` },
	});
	//Promiseの作成
	return await Promise.all(
		institutions.map(async (inst) => {
			//categoryが既に存在しない場合作成
			if (
				!response.data.some((a) => {
					return a.name == inst;
				})
			) {
				const data = {
					name: inst,
					code: inst,
				};
				const createResponse = await axios.post(
					`${endpointUrl}/v1/institutions`,
					data,
					{
						headers: { Authorization: `Token ${token}` },
					}
				);
				if (createResponse.status == 201) {
					return `Institution ${inst} created.`;
				} else {
					return `Error creating institution ${inst}.`;
				}
			} else {
				return `Institution ${inst} already exists.`;
			}
		})
	).then(async (results) => {
		results.forEach((result) => {
			if (logger) {
				logger.push(result);
			}
			console.log(result);
		});
		const responseReturn = await axios.get(`${endpointUrl}/v1/institutions`, {
			headers: { Authorization: `Token ${token}` },
		});
		return responseReturn.data;
	});
}

async function createTeamCategory(categories, logger) {
	const response = await axios.get(
		`${endpointUrl}/v1/tournaments/${slug}/break-categories`,
		{
			headers: { Authorization: `Token ${token}` },
		}
	);
	//seqの存在する最大値を取得、それに+1, +2したものを新しいcategoryのseqとする
	var seqIndex = response.data.reduce((accumulator, current) => {
		Math.max(accumulator, current.seq);
	}, 0);
	//Promiseの作成
	return await Promise.all(
		categories.map(async (cat) => {
			//categoryが既に存在しない場合作成
			if (
				!response.data.some((a) => {
					return a.name == cat;
				})
			) {
				const data = {
					name: cat,
					slug: cat.toLowerCase().replace(" ", "_"),
					seq: seqIndex + 1,
					break_size: 8,
					is_general: false,
					priority: 0,
				};
				seqIndex++;
				const createResponse = await axios.post(
					`${endpointUrl}/v1/tournaments/${slug}/break-categories`,
					data,
					{
						headers: { Authorization: `Token ${token}` },
					}
				);
				if (createResponse.status == 201) {
					return `Team category ${cat} created.`;
				} else {
					return `Error creating team category ${cat}.`;
				}
			} else {
				return `Team category ${cat} already exists.`;
			}
		})
	).then(async (results) => {
		results.forEach((result) => {
			if (logger) {
				logger.push(result);
			}
			console.log(result);
		});
		const responseReturn = await axios.get(
			`${endpointUrl}/v1/tournaments/${slug}/break-categories`,
			{
				headers: { Authorization: `Token ${token}` },
			}
		);
		return responseReturn.data;
	});
}

async function createSpeakerCategory(categories, logger) {
	const response = await axios.get(
		`${endpointUrl}/v1/tournaments/${slug}/speaker-categories`,
		{
			headers: { Authorization: `Token ${token}` },
		}
	);
	//seqの存在する最大値を取得、それに+1, +2したものを新しいcategoryのseqとする
	var seqIndex = response.data.reduce((accumulator, current) => {
		Math.max(accumulator, current.seq);
	}, 0);
	//Promiseの作成
	return await Promise.all(
		categories.map(async (cat) => {
			//categoryが既に存在しない場合作成
			if (
				!response.data.some((a) => {
					return a.name == cat;
				})
			) {
				const data = {
					name: cat,
					slug: cat.toLowerCase().replace(" ", "_"),
					seq: seqIndex + 1,
				};
				seqIndex++;
				const createResponse = await axios.post(
					`${endpointUrl}/v1/tournaments/${slug}/speaker-categories`,
					data,
					{
						headers: { Authorization: `Token ${token}` },
					}
				);
				if (createResponse.status == 201) {
					return `Speaker category ${cat} created.`;
				} else {
					return `Error creating speaker category ${cat}.`;
				}
			} else {
				return `Speaker category ${cat} already exists.`;
			}
		})
	).then(async (results) => {
		results.forEach((result) => {
			if (logger) {
				logger.push(result);
			}
			console.log(result);
		});
		const responseReturn = await axios.get(
			`${endpointUrl}/v1/tournaments/${slug}/speaker-categories`,
			{
				headers: { Authorization: `Token ${token}` },
			}
		);
		return responseReturn.data;
	});
}
