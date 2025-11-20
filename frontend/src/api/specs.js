import axios from "axios";

const API_BASE = "/api";

export const fetchSpecs = async () => {
  const response = await axios.get(`${API_BASE}/specs`);
  return response.data;
};

export const fetchSpec = async (id) => {
  const response = await axios.get(`${API_BASE}/specs/${id}`);
  return response.data;
};

export const createSpec = async (data) => {
  const response = await axios.post(`${API_BASE}/specs`, data);
  return response.data;
};

export const updateSpec = async (id, data) => {
  const response = await axios.put(`${API_BASE}/specs/${id}`, data);
  return response.data;
};

export const deleteSpec = async (id) => {
  await axios.delete(`${API_BASE}/specs/${id}`);
};

export const validateSpec = async (spec_json) => {
  const response = await axios.post(`${API_BASE}/validate`, spec_json);
  return response.data;
};

export const fetchDiff = async (id, format = "json") => {
  const response = await axios.get(`${API_BASE}/specs/${id}/diff`, {
    params: { format },
  });
  return response.data;
};
