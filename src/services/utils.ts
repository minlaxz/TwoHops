export function splitList(raw: string, splitter: string = ","): string[] {
    return raw
        .split(splitter)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

export function joinList(items: string[], joiner: string = ", "): string {
    return items.join(joiner);
}

export const fetchRemoteURL = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch routing rules: ${response.statusText}`);
        }
        return (await response.text()).replace(/\r/g, '').replace("\n", ",");
    } catch (error) {
        console.error('Error fetching remote routing rules:', error);
        return '';
    }
}
