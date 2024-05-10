import { Table } from "@mantine/core";
import { useMemo } from "react";
import { SolveBasic, AverageOf, get_ao, print_avg, getAverage } from "./SidePanelTimeList";


export function Statistics({ solves, showCurrent = true }: { solves: Array<SolveBasic>; showCurrent?: boolean; }) {
    // show statistics from a list of solves
    // if current is false, do not show the current ao5, this is used when
    // the statistics are shown on user page, where the user is not currenly solving

    const averages: AverageOf[] = useMemo(() => {
        let averageSizes = [5]; // always show average of 5

        // if there is enough solves, show bigger averages, show them
        for (const size of [12, 50, 100]) {
            if (size < solves.length) averageSizes.push(size);
        }

        return averageSizes.map((solveCount) => {
            // if there is not enough solves, show "-"
            // can happen if number of solves is less than five
            if (solveCount > solves.length) {
                return { solvesCount: solveCount, best: "-", last: "-" };
            }

            let last = get_ao(solves, solveCount);
            let best = last;

            for (let i = 1; i < solves.length - solveCount; ++i) {
                const avg = get_ao(solves.slice(i, i + solveCount), solveCount);
                if (avg < best) {
                    best = avg;
                }
            }

            return {
                solvesCount: solveCount,
                last: print_avg(last),
                best: print_avg(best),
            };
        });
    }, [solves]);

    return (
        <>
            <Table>
                <Table.Tbody>
                    <Table.Tr>
                        <Table.Th>Total solves: {solves.length}</Table.Th>
                        <Table.Th>Average: {solves.length ? print_avg(getAverage(solves, true)) : "-"}</Table.Th>
                    </Table.Tr>
                    <Table.Tr>
                        <Table.Th></Table.Th>
                        {showCurrent && <Table.Th>Current</Table.Th>}
                        <Table.Th>Best</Table.Th>
                    </Table.Tr>
                    {averages.map((avg) => (
                        <Table.Tr key={avg.solvesCount}>
                            <Table.Th>AO{avg.solvesCount}</Table.Th>
                            {showCurrent && <Table.Th>{avg.last}</Table.Th>}
                            <Table.Th>{avg.best}</Table.Th>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </>
    );
}
