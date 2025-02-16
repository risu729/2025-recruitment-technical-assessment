use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};

pub async fn process_data(Json(request): Json<DataRequest>) -> impl IntoResponse {
    let response = DataResponse {
        string_len: request.data.iter().filter_map(|x| match x {
            StringOrInt::String(s) => Some(s.len() as i32),
            _ => None,
        }).sum(),
        int_sum: request.data.iter().filter_map(|x| match x {
            StringOrInt::Int(i) => Some(i),
            _ => None,
        }).sum(),
    };

    (StatusCode::OK, Json(response))
}

#[derive(Deserialize)]
#[serde(untagged)]
enum StringOrInt {
    String(String),
    Int(i32),
}

#[derive(Deserialize)]
pub struct DataRequest {
    data: Vec<StringOrInt>,
}

#[derive(Serialize)]
pub struct DataResponse {
    string_len: i32,
    int_sum: i32,
}
