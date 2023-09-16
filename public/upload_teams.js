let importDataModified;

//Convert the given data to a compact object
let dataFormat = ({
	team_name = "",
	team_reference = "",
	team_emoji = "",
	institution = "",
	team_category = "",
	speaker1_name = "",
	speaker1_email = "",
	speaker1_category = "",
	speaker2_name = "",
	speaker2_email = "",
	speaker2_category = "",
	speaker3_name = "",
	speaker3_email = "",
	speaker3_category = "",
}) => {
	let ret = {
		team_name,
		team_reference: team_reference
			? team_reference.slice(0, 35)
			: team_name.slice(0, 35),
		team_emoji,
		institution,
		team_category: team_category ? team_category.split(/ ?[,\/] ?/) : [],
		speakers: [],
	};
	if (speaker1_name) {
		ret.speakers.push({
			name: speaker1_name,
			email: speaker1_email,
			category: speaker1_category ? speaker1_category.split(/ ?[,\/] ?/) : [],
		});
	}
	if (speaker2_name) {
		ret.speakers.push({
			name: speaker2_name,
			email: speaker2_email,
			category: speaker2_category ? speaker2_category.split(/ ?[,\/] ?/) : [],
		});
	}
	if (speaker3_name) {
		ret.speakers.push({
			name: speaker3_name,
			email: speaker3_email,
			category: speaker3_category ? speaker3_category.split(/ ?[,\/] ?/) : [],
		});
	}
	ret.appendRowTo = (emojiBool, speakerNums, jQuery) => {
		var returnRow = $("<tr></tr>");
		returnRow
			.append(`<td>${ret.team_name}</td>`)
			.append(`<td>${ret.team_reference}</td>`);
		if (emojiBool) {
			returnRow.append(`<td>${ret.team_emoji}</td>`);
		}
		returnRow
			.append(`<td>${ret.institution}</td>`)
			.append(`<td>${ret.team_category}</td>`);
		for (speakerIndex = 0; speakerIndex < speakerNums; speakerIndex++) {
			if (speakerIndex < ret.speakers.length) {
				returnRow
					.append(`<td>${ret.speakers[speakerIndex].name}</td>`)
					.append(`<td>${ret.speakers[speakerIndex].email}</td>`)
					.append(`<td>${ret.speakers[speakerIndex].category}</td>`);
			} else {
				returnRow.append("<td></td>").append("<td></td>").append("<td></td>");
			}
		}
		returnRow.appendTo(jQuery);
	};
	return ret;
};

async function loadFile() {
	const files = $("#formFile").prop("files");
	const workbook = XLSX.read(await files[0].arrayBuffer());
	const importData = XLSX.utils.sheet_to_json(
		workbook.Sheets[workbook.SheetNames[0]],
		{}
	);
	importDataModified = importData.map((row) => dataFormat(row));
	//console.log(importDataModified);
	createSummaryTable(importDataModified);
}

function createSummaryTable(tableArray) {
	$("#worksheet-area").empty();
	let necessaryIndices = ["team_name", "team_reference"];
	//Process importDataModified and find the indices to display
	//Possible existence: team_name, team_reference, team_emoji, institution, team_category, speakers[0, 1, 2]
	if (tableArray.some((e) => e.team_emoji)) {
		//team emoji exists
		necessaryIndices.push("team_emoji");
	}
	necessaryIndices.push("institution", "team_category");
	const maxSpeakers = tableArray.reduce(
		(p, c) => Math.max(p, c.speakers.length),
		0
	);
	for (i = 1; i <= maxSpeakers; i++) {
		necessaryIndices.push(
			`speaker${i}_name`,
			`speaker${i}_email`,
			`speaker${i}_category`
		);
	}

	//Create the table
	//Create index
	let tableHeadRow = $("<tr></tr>");
	necessaryIndices.forEach((i) => {
		tableHeadRow.append(`<td>${i}</td>`);
	});
	//Create each team
	let tableBody = $("<tbody></tbody>");
	tableArray.forEach((team) => {
		team.appendRowTo(
			necessaryIndices.includes("team_emoji"),
			maxSpeakers,
			tableBody
		);
	});
	$(`<table class="table table-striped table-hover"></table>`)
		.append($("<thead></thead>").append(tableHeadRow))
		.append(tableBody)
		.appendTo("#worksheet-area");
}

function updateResults(data) {
	$("#previous-results").empty();
	if (data.length == 0) {
		$("#previous-results").addClass("d-none");
	} else {
		$("#previous-results").removeClass("d-none");
		data.forEach((elem) => {
			$(`<li>${elem}</li>`).appendTo("#previous-results");
		});
	}
}

$(() => {
	$("#formFile").on("change", async () => {
		await loadFile();
	});
	$("#submit").on("click", (event) => {
		$("#submit").prop("disabled", true);
		$("#submit").empty();
		$("#submit").html(
			`<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span role="status">Loading...</span>`
		);
		event.preventDefault();
		$.ajax({
			url: "teams",
			type: "POST",
			data: JSON.stringify({
				teams: importDataModified,
				autoPrefix: $("#institutionPrefix")[0].checked,
			}),
			contentType: "application/json; charset=utf-8",
			dataType: "json",
			complete: (e) => {
				updateResults(e.responseJSON);
				$("#submit").prop("disabled", false);
				$("#submit").html(`Submit`);
				$("#worksheet-area").empty();
			},
		});
	});
});
