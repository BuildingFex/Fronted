export class Incident {
    constructor({ id, residentId, residentName, description, status, createdAt, provider }) {
        this.id = id
        this.residentId = residentId
        this.residentName = residentName
        this.description = description
        this.status = status
        this.createdAt = createdAt
        this.provider = provider
    }
}

