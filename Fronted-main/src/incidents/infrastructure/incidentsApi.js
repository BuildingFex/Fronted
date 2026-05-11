import axios from 'axios'

const BASE_URL = 'http://localhost:3001/incidents'

export const incidentsApi = {
    async list() {
        const { data } = await axios.get(BASE_URL)
        return data
    },
    async add(incident) {
        const { data } = await axios.post(BASE_URL, incident)
        return data
    },
    async update(id, incident) {
        const { data } = await axios.put(`${BASE_URL}/${id}`, incident)
        return data
    },
    async remove(id) {
        await axios.delete(`${BASE_URL}/${id}`)
    }
}


