import { useEffect, useState } from "react"
import TimeList, { Solve } from "../components/TimeList";
import ErrorPage from "./ErrorPage";
import { Container, Title } from "@mantine/core";
import NavigationButtons from "../components/NavigationButtons";

export default function Leaderboard() {
    const [solves, setSolves] = useState<Solve[]>([])
    const [error, setError] = useState(false);

    useEffect(() => {
        fetch("/api/fetch_solves").then(res => res.json()).then((data: Solve[]) => {
            setSolves(data)
        }).catch(err => setError(true));
    }, [])

    if (error) {
        return <ErrorPage message="Failed to fetch solves." />
    }

    return (
        <>
            <NavigationButtons />
            <Container>
                <Title order={1}>Leaderboard</Title>
                <TimeList solves={solves} setSolves={setSolves} />
            </Container>
        </>
    );
}