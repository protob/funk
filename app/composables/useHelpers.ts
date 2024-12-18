export function useHelpers() {

    function daysAgo(dateString: string) {
        const today: Date = new Date();
        const createdDate: Date = new Date(dateString);
        const timeDifference: number = today.getTime() - createdDate.getTime();
        const daysAgo: number = Math.floor(timeDifference / (1000 * 3600 * 24));
        return daysAgo;
    }

    function formatDateString(dateString: string) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return {
        daysAgo,
        formatDateString

    };
}
